// ══ FIREBASE IMPORTS (CDN) ══════════════════════════════════════════════
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.7.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut as fbOut }
  from "https://www.gstatic.com/firebasejs/11.7.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, addDoc, updateDoc, collection,
  query, orderBy, limit, onSnapshot, getDocs, increment, runTransaction,
  where, serverTimestamp }
  from "https://www.gstatic.com/firebasejs/11.7.1/firebase-firestore.js";
import { getDatabase, ref, set, onValue, onDisconnect, remove, update }
  from "https://www.gstatic.com/firebasejs/11.7.1/firebase-database.js";

// ══ FIREBASE CONFIG ══════════════════════════════════════════════════════
const firebaseConfig = {
  apiKey:            "AIzaSyB2bZYw8ZO19kUKdnM3bxd2RsSnFcChd90",
  authDomain:        "studysync-40899.firebaseapp.com",
  projectId:         "studysync-40899",
  storageBucket:     "studysync-40899.firebasestorage.app",
  messagingSenderId: "285900986495",
  appId:             "1:285900986495:web:b0475fb7c269d9803b074a",
  measurementId:     "G-FVJFBYYWPY",
  // ⚠️ Create a Realtime Database in Firebase Console, then update this URL:
  databaseURL:       "https://studysync-40899-default-rtdb.firebaseio.com",
};

const fbApp = initializeApp(firebaseConfig);
const auth  = getAuth(fbApp);
const db    = getFirestore(fbApp);
const rtdb  = getDatabase(fbApp);
const gp    = new GoogleAuthProvider();

// ══ STATE ════════════════════════════════════════════════════════════════
let user = null, profile = null;
let groups = [], exploreGroups = [], notifications = [], threads = [], dms = [];
let room = { group:null, members:[], messages:[], statuses:[] }, presence = [];
let selGroup = "", selThread = "";
let stopRoom = null, stopPresence = null, stopThread = null;
let typingTimer = null, errTimer = null;

// ══ DOM HELPERS ══════════════════════════════════════════════════════════
const $ = id => document.getElementById(id);
const txt = (id, v) => { const e=$( id); if(e) e.textContent = v; };
const htm = (id, v) => { const e=$(id); if(e) e.innerHTML   = v; };
const show = id => $(id)?.classList.remove("hidden");
const hide = id => $(id)?.classList.add("hidden");
const fmt  = ts => ts ? new Date(typeof ts==="number"?ts:Date.now()).toLocaleString() : "";

function av(name, src) {
  if (src) return `<img class="avatar" src="${src}" alt="${name||""}">`;
  const i=(name||"SS").split(" ").map(p=>p[0]).slice(0,2).join("").toUpperCase();
  return `<span class="avatar-fallback">${i}</span>`;
}
function showErr(msg) {
  const el=$("error-pill"); if(!el) return;
  el.textContent=msg; el.classList.remove("hidden");
  clearTimeout(errTimer); errTimer=setTimeout(()=>el.classList.add("hidden"),3500);
}
function showPage(page) {
  document.querySelectorAll(".page").forEach(p=>p.classList.add("hidden"));
  $("page-"+page)?.classList.remove("hidden");
  document.querySelectorAll(".nav-link").forEach(l=>l.classList.toggle("active",l.dataset.page===page));
  window.location.hash = page==="dashboard" ? "" : page;
  if (page==="room")     { startRoomSubs(); }
  else                   { stopRoom?.(); stopPresence?.(); stopRoom=stopPresence=null; }
  if (page==="messages") { startThreadSub(); }
  else                   { stopThread?.(); stopThread=null; }
}

// ══ FIREBASE DATA ════════════════════════════════════════════════════════
async function ensureProfile(u) {
  const r = doc(db,"users",u.uid), snap = await getDoc(r);
  if (!snap.exists()) {
    const p = { id:u.uid, email:u.email||"", fullName:u.displayName||"StudySync User",
      avatarUrl:u.photoURL||"", university:"", bio:"", studyInterests:[],
      streakDays:0, totalFocusMinutes:0, dailyGoalMinutes:120, createdAt:Date.now(), updatedAt:Date.now() };
    await setDoc(r, p);
    await addDoc(collection(db,"users",u.uid,"notifications"),{
      title:"You're in 👋", body:"Find a room, or make one. Start studying with people who get it.", isRead:false, createdAt:Date.now() });
    return p;
  }
  return { id:u.uid, ...snap.data() };
}
async function loadData() {
  if (!user) return;
  const ms = await getDocs(collection(db,"users",user.uid,"memberships"));
  groups = (await Promise.all(ms.docs.map(async m=>{
    const g=await getDoc(doc(db,"groups",m.id)); return g.exists()?g.data():null;
  }))).filter(Boolean);
  const eg = await getDocs(query(collection(db,"groups"),orderBy("createdAt","desc"),limit(24)));
  exploreGroups = eg.docs.map(d=>d.data());
  const ns = await getDocs(query(collection(db,"users",user.uid,"notifications"),orderBy("createdAt","desc"),limit(6)));
  notifications = ns.docs.map(d=>({id:d.id,...d.data(),createdAtLabel:fmt(d.data().createdAt)}));
  const ts = await getDocs(query(collection(db,"users",user.uid,"directThreads"),orderBy("updatedAt","desc"),limit(20)));
  threads = ts.docs.map(d=>({id:d.id,...d.data(),updatedAtLabel:fmt(d.data().updatedAt)}));
  if (!selGroup && groups.length) selGroup = groups[0].id;
  if (!selThread && threads.length) selThread = threads[0].id;
}
function startRoomSubs() {
  stopRoom?.(); stopPresence?.(); stopRoom=stopPresence=null;
  if (!user||!selGroup) return;
  const lbl = ts=>ts?new Date(typeof ts==="number"?ts:Date.now()).toLocaleString():"";
  const u1=onSnapshot(doc(db,"groups",selGroup),s=>{room.group=s.exists()?s.data():null;renderRoom();});
  const u2=onSnapshot(query(collection(db,"groups",selGroup,"members"),orderBy("joinedAt","asc")),s=>{room.members=s.docs.map(d=>d.data());renderRoom();});
  const u3=onSnapshot(query(collection(db,"groups",selGroup,"messages"),orderBy("createdAt","asc"),limit(100)),s=>{room.messages=s.docs.map(d=>({id:d.id,...d.data(),createdAtLabel:lbl(d.data().createdAt)}));renderRoom();});
  const u4=onSnapshot(query(collection(db,"groups",selGroup,"statuses"),orderBy("updatedAt","desc"),limit(20)),s=>{room.statuses=s.docs.map(d=>({id:d.id,...d.data()}));renderRoom();});
  stopRoom=()=>{u1();u2();u3();u4();};
  const myRef=ref(rtdb,`presence/groups/${selGroup}/${user.uid}`);
  set(myRef,{userId:user.uid,fullName:profile.fullName,avatarUrl:profile.avatarUrl,statusText:"Online",focusMode:false,onlineAt:Date.now(),typing:false});
  onDisconnect(myRef).remove();
  const unsub=onValue(ref(rtdb,`presence/groups/${selGroup}`),s=>{
    presence=Object.values(s.val()||{}); txt("presence-count",presence.length);
    const typing=presence.filter(p=>p.typing&&p.userId!==user.uid);
    txt("typing-hint",typing.length?`✍️ ${typing.length>1?"Several people":"Someone"} is typing…`:"");
  });
  stopPresence=async()=>{unsub();await remove(myRef);};
}
function startThreadSub() {
  stopThread?.(); stopThread=null;
  if (!user||!selThread) return;
  const lbl=ts=>ts?new Date(typeof ts==="number"?ts:Date.now()).toLocaleString():"";
  stopThread=onSnapshot(query(collection(db,"directThreads",selThread,"messages"),orderBy("createdAt","asc"),limit(100)),
    s=>{dms=s.docs.map(d=>({id:d.id,...d.data(),createdAtLabel:lbl(d.data().createdAt)}));renderDMs();});
}

// ══ RENDER FUNCTIONS ════════════════════════════════════════════════════
function fillUI() {
  const n=profile.fullName||"User", e=profile.email||"";
  txt("sidebar-name",n); txt("sidebar-email",e);
  txt("topbar-name",n);  txt("topbar-email",e);
  txt("dash-firstname",n.split(" ")[0]);
  txt("profile-display-name",n); txt("profile-display-email",e);
  txt("settings-email",e);
  htm("sidebar-avatar",av(n,profile.avatarUrl)); htm("topbar-avatar",av(n,profile.avatarUrl));
  htm("profile-avatar",av(n,profile.avatarUrl));
  if($("p-fullname"))    $("p-fullname").value    = profile.fullName||"";
  if($("p-email"))       $("p-email").value       = e;
  if($("p-university"))  $("p-university").value  = profile.university||"";
  if($("p-interests"))   $("p-interests").value   = (profile.studyInterests||[]).join(", ");
  if($("p-bio"))         $("p-bio").value         = profile.bio||"";
  if($("s-goal"))        $("s-goal").value        = profile.dailyGoalMinutes||120;
  txt("stat-streak",(profile.streakDays||0)+" days");
  txt("stat-focus",(profile.totalFocusMinutes||0)+" min");
  txt("stat-goal",(profile.dailyGoalMinutes||120)+" min");
  txt("stat-groups",groups.length);
  txt("profile-since",profile.createdAt?new Date(profile.createdAt).toLocaleDateString():"—");
  htm("profile-tags",(profile.studyInterests||[]).map(t=>`<span class="badge">${t}</span>`).join("")||"<p>None added yet.</p>");
}
function renderRooms() {
  htm("dash-rooms",groups.length
    ?groups.map(g=>`<button class="list-card" data-action="open-room" data-gid="${g.id}"><span class="badge">${g.category}</span><strong>${g.name}</strong><p>${g.description}</p></button>`).join("")
    :"<p class='empty-state'>Join or create a group to start.</p>");
  const sel=$("room-selector");
  if(sel) sel.innerHTML=groups.map(g=>`<option value="${g.id}"${selGroup===g.id?" selected":""}>${g.name}</option>`).join("");
}
function renderExplore() {
  htm("explore-groups",exploreGroups.length
    ?exploreGroups.map(g=>`<div class="list-card static"><span class="badge">${g.category}</span><strong>${g.name}</strong><p>${g.description}</p><div class="tags">${(g.tags||[]).map(t=>`<span class="badge">${t}</span>`).join("")}</div><div class="split-row"><span class="meta">👥 ${g.activeMemberCount||0} members</span><button class="btn-ghost" data-action="join-group" data-gid="${g.id}">Join</button></div></div>`).join("")
    :"<p class='empty-state'>No groups yet. Create the first one!</p>");
}
function renderNotifs() {
  htm("dash-notifications",notifications.length
    ?notifications.map(n=>`<div class="notif-item"><div class="notif-dot"></div><div class="notif-body"><strong>${n.title}</strong><p>${n.body}</p><span class="meta">${n.createdAtLabel||""}</span></div></div>`).join("")
    :"<p class='empty-state'>No alerts yet.</p>");
}
function renderRoom() {
  const g=room.group||groups.find(x=>x.id===selGroup);
  if(g){txt("room-name",g.name);txt("room-desc",g.description);}
  htm("status-board",room.statuses.length
    ?room.statuses.map(s=>`<div class="list-card static"><div class="user-row">${av(s.fullName,s.avatarUrl)}<div><strong style="font-size:.8rem">${s.fullName}</strong><p>${s.statusText}</p></div>${s.isFocusMode?`<span class="badge" style="margin-left:auto">🎯</span>`:""}</div></div>`).join("")
    :"<p class='empty-state'>No statuses yet.</p>");
  htm("group-messages",room.messages.length
    ?room.messages.map(m=>`<div class="msg">${av(m.senderName,m.senderAvatar)}<div class="msg-bubble"><div class="msg-head"><strong>${m.senderName}</strong><span>${m.createdAtLabel||""}</span></div><p>${m.body}</p></div></div>`).join("")
    :"<p class='empty-state'>No messages yet. Start the first check-in!</p>");
  htm("room-members",room.members.length
    ?room.members.map(m=>`<div class="list-card static"><div class="user-row">${av(m.fullName,m.avatarUrl)}<div style="flex:1;min-width:0"><strong style="font-size:.8rem">${m.fullName}</strong><p style="font-size:.72rem">${m.email}</p></div></div><div class="split-row"><span class="badge">${m.role}</span><button class="btn-ghost" data-action="start-dm" data-email="${m.email}">Message</button></div></div>`).join("")
    :"<p class='empty-state'>Members appear after joining.</p>");
  setTimeout(()=>{const ml=$("group-messages");if(ml)ml.scrollTop=ml.scrollHeight;},50);
}
function renderThreads() {
  htm("thread-list",threads.length
    ?threads.map(t=>`<button class="list-card${selThread===t.id?" selected":""}" data-action="open-thread" data-tid="${t.id}"><strong>${t.otherUserName}</strong><p>${t.lastMessage||"No messages yet"}</p><span class="meta">${t.updatedAtLabel||""}</span></button>`).join("")
    :"<p class='empty-state'>No DMs yet.</p>");
}
function renderDMs() {
  const at=threads.find(t=>t.id===selThread);
  if(at) txt("dm-partner-name",at.otherUserName);
  htm("dm-messages",dms.length
    ?dms.map(m=>`<div class="msg${m.senderId===profile?.id?" self":""}">${av(m.senderName,m.senderAvatar)}<div class="msg-bubble"><div class="msg-head"><strong>${m.senderName}</strong><span>${m.createdAtLabel||""}</span></div><p>${m.body}</p></div></div>`).join("")
    :"<p class='empty-state'>Open a thread to begin messaging.</p>");
  setTimeout(()=>{const ml=$("dm-messages");if(ml)ml.scrollTop=ml.scrollHeight;},50);
}

// ══ EVENT HANDLERS ═══════════════════════════════════════════════════════
document.addEventListener("click", async e=>{
  const t=e.target.closest("[data-page],[data-action]"); if(!t) return;
  if(t.dataset.page){showPage(t.dataset.page);return;}
  try {
    if(t.dataset.action==="sign-in") await signInWithPopup(auth,gp);
    if(t.dataset.action==="sign-out"){stopRoom?.();stopPresence?.();stopThread?.();await fbOut(auth);user=null;profile=null;groups=[];hide("app-shell");show("auth-screen");return;}
    if(t.dataset.action==="open-room"){selGroup=t.dataset.gid;showPage("room");renderRoom();}
    if(t.dataset.action==="join-group"){
      const g=exploreGroups.find(x=>x.id===t.dataset.gid);if(!g)return;
      const gR=doc(db,"groups",g.id),mR=doc(db,"groups",g.id,"members",user.uid),uR=doc(db,"users",user.uid,"memberships",g.id);
      await runTransaction(db,async tx=>{if((await tx.get(mR)).exists())return;tx.set(mR,{userId:user.uid,role:"member",fullName:profile.fullName,avatarUrl:profile.avatarUrl,email:profile.email,joinedAt:Date.now()});tx.set(uR,{groupId:g.id,name:g.name,category:g.category,joinedAt:Date.now(),role:"member"});tx.update(gR,{activeMemberCount:increment(1),updatedAt:Date.now()});});
      await loadData();renderRooms();renderExplore();fillUI();
    }
    if(t.dataset.action==="open-thread"){selThread=t.dataset.tid;renderThreads();renderDMs();startThreadSub();}
    if(t.dataset.action==="start-dm"){
      const email=t.dataset.email?.trim().toLowerCase();if(!email)return;
      const r=await getDocs(query(collection(db,"users"),where("email","==",email),limit(1)));
      if(r.empty){showErr("No StudySync profile for that email.");return;}
      const them=r.docs[0].data();if(them.id===profile.id){showErr("Pick another study partner.");return;}
      await openDM(them);
    }
  } catch(ex){showErr(ex.message||"Something went wrong.");}
});
document.addEventListener("change",e=>{if(e.target.id==="room-selector"){selGroup=e.target.value;startRoomSubs();renderRoom();}});
document.addEventListener("input",async e=>{
  if(e.target.id==="group-msg-input"&&selGroup&&user){
    await update(ref(rtdb,`presence/groups/${selGroup}/${user.uid}`),{typing:true});
    clearTimeout(typingTimer);typingTimer=setTimeout(async()=>await update(ref(rtdb,`presence/groups/${selGroup}/${user.uid}`),{typing:false}),900);
  }
});
document.addEventListener("submit",async e=>{
  e.preventDefault();const f=e.target,d=new FormData(f);
  try{
    if(f.id==="form-create-group"){
      const id=crypto.randomUUID(),now=Date.now();
      const p2={id,ownerId:user.uid,name:d.get("name").trim(),category:d.get("category").trim(),description:d.get("description").trim(),tags:String(d.get("tags")||"").split(",").map(t=>t.trim()).filter(Boolean),isPrivate:d.get("isPrivate")==="on",activeMemberCount:1,createdAt:now,updatedAt:now};
      await setDoc(doc(db,"groups",id),p2);
      await setDoc(doc(db,"groups",id,"members",user.uid),{userId:user.uid,role:"owner",fullName:profile.fullName,avatarUrl:profile.avatarUrl,email:profile.email,joinedAt:now});
      await setDoc(doc(db,"users",user.uid,"memberships",id),{groupId:id,name:p2.name,category:p2.category,joinedAt:now,role:"owner"});
      selGroup=id;f.reset();await loadData();renderRooms();showPage("room");
    }
    if(f.id==="form-status"){
      const st=d.get("statusText").trim()||"Studying",fm=d.get("focusMode")==="on";
      await setDoc(doc(db,"groups",selGroup,"statuses",user.uid),{userId:user.uid,groupId:selGroup,fullName:profile.fullName,avatarUrl:profile.avatarUrl,statusText:st,isFocusMode:fm,updatedAt:Date.now()});
      await update(ref(rtdb,`presence/groups/${selGroup}/${user.uid}`),{statusText:st,focusMode:fm,updatedAt:Date.now()});
    }
    if(f.id==="form-group-msg"){
      const body=d.get("body").trim();if(!body||!selGroup)return;
      await addDoc(collection(db,"groups",selGroup,"messages"),{senderId:user.uid,senderName:profile.fullName,senderAvatar:profile.avatarUrl,body,createdAt:Date.now(),serverCreatedAt:serverTimestamp()});
      await update(ref(rtdb,`presence/groups/${selGroup}/${user.uid}`),{typing:false});f.reset();
    }
    if(f.id==="form-start-dm"){
      const email=d.get("email").trim().toLowerCase();
      const r=await getDocs(query(collection(db,"users"),where("email","==",email),limit(1)));
      if(r.empty){showErr("No StudySync profile for that email.");return;}
      const them=r.docs[0].data();if(them.id===profile.id){showErr("Pick another study partner.");return;}
      await openDM(them);f.reset();
    }
    if(f.id==="form-dm"){
      const body=d.get("body").trim(),at=threads.find(t=>t.id===selThread);if(!body||!at)return;
      const now=Date.now();
      await addDoc(collection(db,"directThreads",selThread,"messages"),{senderId:profile.id,recipientId:at.otherUserId,senderName:profile.fullName,senderAvatar:profile.avatarUrl,body,createdAt:now,serverCreatedAt:serverTimestamp()});
      await Promise.all([setDoc(doc(db,"users",profile.id,"directThreads",selThread),{threadId:selThread,otherUserId:at.otherUserId,otherUserName:at.otherUserName,otherUserAvatar:at.otherUserAvatar,lastMessage:body,updatedAt:now},{merge:true}),setDoc(doc(db,"users",at.otherUserId,"directThreads",selThread),{threadId:selThread,otherUserId:profile.id,otherUserName:profile.fullName,otherUserAvatar:profile.avatarUrl,lastMessage:body,updatedAt:now},{merge:true})]);
      await loadData();renderThreads();f.reset();
    }
    if(f.id==="form-profile"){
      const p2={fullName:d.get("fullName").trim(),university:d.get("university").trim(),bio:d.get("bio").trim(),studyInterests:String(d.get("studyInterests")).split(",").map(i=>i.trim()).filter(Boolean),updatedAt:Date.now()};
      await updateDoc(doc(db,"users",profile.id),p2);profile={...profile,...p2};fillUI();
    }
    if(f.id==="form-settings"){
      const p2={dailyGoalMinutes:Number(d.get("dailyGoalMinutes"))||120};
      await updateDoc(doc(db,"users",profile.id),p2);profile={...profile,...p2};fillUI();
    }
  }catch(ex){showErr(ex.message||"Something went wrong.");}
});

// ══ SHARED DM HELPER ════════════════════════════════════════════════════
async function openDM(them) {
  const key=[profile.id,them.id].sort().join("_"),tRef=doc(db,"directThreads",key),now=Date.now();
  if(!(await getDoc(tRef)).exists()){
    await setDoc(tRef,{id:key,participantIds:[profile.id,them.id],createdAt:now,updatedAt:now});
    await setDoc(doc(db,"directThreads",key,"members",profile.id),{userId:profile.id,fullName:profile.fullName,avatarUrl:profile.avatarUrl,email:profile.email,joinedAt:now});
    await setDoc(doc(db,"directThreads",key,"members",them.id),{userId:them.id,fullName:them.fullName,avatarUrl:them.avatarUrl,email:them.email,joinedAt:now});
  }
  await Promise.all([setDoc(doc(db,"users",profile.id,"directThreads",key),{threadId:key,otherUserId:them.id,otherUserName:them.fullName,otherUserAvatar:them.avatarUrl,updatedAt:now},{merge:true}),setDoc(doc(db,"users",them.id,"directThreads",key),{threadId:key,otherUserId:profile.id,otherUserName:profile.fullName,otherUserAvatar:profile.avatarUrl,updatedAt:now},{merge:true})]);
  selThread=key;await loadData();renderThreads();showPage("messages");startThreadSub();
}

// ══ BOOT ═════════════════════════════════════════════════════════════════
onAuthStateChanged(auth, async u=>{
  if(!u){hide("boot-screen");hide("app-shell");show("auth-screen");return;}
  try{
    user=u;profile=await ensureProfile(u);
    await loadData();
    fillUI();renderRooms();renderExplore();renderNotifs();renderThreads();
    hide("boot-screen");hide("auth-screen");show("app-shell");
    const pg=window.location.hash.replace("#","");
    showPage(["dashboard","explore","room","messages","profile","settings"].includes(pg)?pg:"dashboard");
  }catch(ex){hide("boot-screen");show("auth-screen");showErr(ex.message);}
});

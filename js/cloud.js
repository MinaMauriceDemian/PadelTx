// Online layer (Firebase Auth + Firestore). Loaded as a module; only runs when js/config.js has real settings.
// Online layer (Firebase). Only loads when FIREBASE_CONFIG has been filled in.
if(window.CLOUD_ON){
  const V="10.14.1", base="https://www.gstatic.com/firebasejs/"+V+"/";
  try{
    const [{initializeApp},A,F]=await Promise.all([import(base+"firebase-app.js"),import(base+"firebase-auth.js"),import(base+"firebase-firestore.js")]);
    const app=initializeApp(window.FIREBASE_CONFIG), auth=A.getAuth(app), db=F.getFirestore(app);
    const T=id=>F.doc(db,"tournaments",id);
    let tid=null,unsubT=null,unsubAux=null,lastData=null,roleKey=null,auxKey=null,firstAuth=true;
    const ALPHA="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const genId=()=>{const a=new Uint32Array(7);crypto.getRandomValues(a);return Array.from(a,n=>ALPHA[n%ALPHA.length]).join("")};
    const err=e=>e.code||e.message||"error";

    function roleNow(){const u=auth.currentUser;const r=u&&lastData&&lastData.members?lastData.members[u.uid]:null;return r==="admin"||r==="editor"?r:"viewer"}
    function pushRole(){
      const u=auth.currentUser,r=roleNow(),key=r+"|"+(u?u.uid:"");
      if(key!==roleKey){roleKey=key;window.__setRole(r,u?{email:u.email,uid:u.uid}:null)}
      const ak=tid+"|"+r+"|"+(u?u.uid:"");
      if(ak!==auxKey){
        auxKey=ak;if(unsubAux){unsubAux();unsubAux=null}
        if(tid&&r==="admin")unsubAux=F.onSnapshot(F.collection(db,"tournaments",tid,"requests"),s=>window.__setRequests(s.docs.map(d=>({uid:d.id,...d.data()}))),()=>{});
        else if(tid&&u)unsubAux=F.onSnapshot(F.doc(db,"tournaments",tid,"requests",u.uid),s=>window.__setMyRequest(s.exists()?s.data().status:null),()=>{});
        else window.__setMyRequest(null);
      }
    }
    function leave(){if(unsubT){unsubT();unsubT=null}if(unsubAux){unsubAux();unsubAux=null}tid=null;lastData=null;roleKey=null;auxKey=null}

    window.__cloud={
      async open(id){
        try{
          const snap=await F.getDoc(T(id));
          if(!snap.exists())return {ok:false,error:"not-found"};
          leave();tid=id;lastData=snap.data();
          window.__applyRemote(lastData);pushRole();window.__cloudStatus("live");
          unsubT=F.onSnapshot(T(id),s=>{
            if(!s.exists()){window.__toast("This tournament no longer exists.");return}
            lastData=s.data();window.__applyRemote(lastData);pushRole();window.__cloudStatus("live");
          },e=>window.__toast("Lost connection to the tournament ("+err(e)+")"));
          return {ok:true}
        }catch(e){return {ok:false,error:err(e)}}
      },
      leave,
      async create(name,opts={}){
        const u=auth.currentUser;if(!u)return {ok:false,error:"not signed in"};
        try{
          const d=window.__defaults(opts.teams||8);
          for(let i=0;i<6;i++){
            const id=genId();
            if((await F.getDoc(T(id))).exists())continue;
            await F.setDoc(T(id),{name,ownerUid:u.uid,members:{[u.uid]:"admin"},memberUids:[u.uid],teams:d.teams,style:opts.style||"groups_ko",visibility:opts.visibility==="private"?"private":"public",bestOf:{},settings:d.settings,sfPairing:0,scores:{},createdAt:Date.now(),updatedAt:Date.now()});
            return {ok:true,id}
          }
          return {ok:false,error:"id-collision"}
        }catch(e){return {ok:false,error:err(e)}}
      },
      async listMine(){
        const u=auth.currentUser;if(!u)return {ok:true,list:[]};
        try{
          const s=await F.getDocs(F.query(F.collection(db,"tournaments"),F.where("memberUids","array-contains",u.uid)));
          const list=s.docs.map(d=>({id:d.id,name:d.data().name||"Tournament",role:(d.data().members||{})[u.uid]||"editor",teams:(d.data().teams||[]).length,visibility:d.data().visibility||"public",createdAt:d.data().createdAt||0})).sort((a,b)=>b.createdAt-a.createdAt);
          return {ok:true,list}
        }catch(e){return {ok:false,error:err(e)}}
      },
      async listPublic(){
        try{
          const s=await F.getDocs(F.query(F.collection(db,"tournaments"),F.where("visibility","==","public"),F.limit(100)));
          const list=s.docs.map(d=>{const x=d.data();return {id:d.id,name:x.name||"Tournament",teams:(x.teams||[]).length,results:Object.keys(x.scores||{}).length,createdAt:x.createdAt||0}}).sort((a,b)=>b.createdAt-a.createdAt);
          return {ok:true,list}
        }catch(e){return {ok:false,error:err(e)}}
      },
      async write(upd){
        if(!tid)return;
        const m={};for(const [k,v] of Object.entries(upd))m[k]=v==="__DEL__"?F.deleteField():v;
        m.updatedAt=Date.now();
        try{await F.updateDoc(T(tid),m)}
        catch(e){window.__toast(e.code==="permission-denied"?"You don't have permission to change this.":"Save failed: "+err(e))}
      },
      async requestAccess(){
        const u=auth.currentUser;if(!u||!tid)return {ok:false};
        try{await F.setDoc(F.doc(db,"tournaments",tid,"requests",u.uid),{email:u.email,status:"pending",requestedAt:Date.now()});return {ok:true}}
        catch(e){return {ok:false,error:err(e)}}
      },
      async setMember(uid,role){
        if(!tid)return {ok:false,error:"no tournament"};
        try{
          const upd={updatedAt:Date.now()};
          if(role){upd["members."+uid]=role;upd.memberUids=F.arrayUnion(uid)}
          else{upd["members."+uid]=F.deleteField();upd.memberUids=F.arrayRemove(uid)}
          await F.updateDoc(T(tid),upd);
          try{await F.updateDoc(F.doc(db,"tournaments",tid,"requests",uid),{status:role?"approved":"removed"})}catch(e){}
          return {ok:true}
        }catch(e){return {ok:false,error:err(e)}}
      },
      async dismissRequest(uid){try{await F.deleteDoc(F.doc(db,"tournaments",tid,"requests",uid))}catch(e){window.__toast("Could not dismiss ("+err(e)+")")}}
    };
    const google=new A.GoogleAuthProvider();
    google.setCustomParameters({prompt:"select_account"});
    window.__auth={
      signIn:(e,p)=>A.signInWithEmailAndPassword(auth,e,p),
      signUp:(e,p)=>A.createUserWithEmailAndPassword(auth,e,p),
      reset:e=>A.sendPasswordResetEmail(auth,e),
      signOut:()=>A.signOut(auth),
      // Popup first; if the browser blocks pop-ups (common on phones), use a full-page redirect instead
      async google(){
        try{return await A.signInWithPopup(auth,google)}
        catch(e){if(e.code==="auth/popup-blocked")return A.signInWithRedirect(auth,google);throw e}
      }
    };
    // Shows an error if a Google redirect sign-in failed (success is picked up by onAuthStateChanged)
    A.getRedirectResult(auth).catch(e=>window.__toast("Google sign-in failed ("+err(e)+")"));
    A.onAuthStateChanged(auth,u=>{
      window.__authState(u?{email:u.email,uid:u.uid}:null);
      if(tid)pushRole();
      if(firstAuth){firstAuth=false;window.__cloudReady()}
    });
  }catch(e){
    window.__toast("Could not connect to the online service. Check the Firebase settings.");
    console.error(e);
  }
}

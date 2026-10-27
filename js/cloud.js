// Online layer (Firebase Auth + Firestore). Loaded as a module; only runs when js/config.js has real settings.
// Online layer (Firebase). Only loads when FIREBASE_CONFIG has been filled in.
if(window.CLOUD_ON){
  const V="10.14.1", base="https://www.gstatic.com/firebasejs/"+V+"/";
  try{
    const [{initializeApp},A,F]=await Promise.all([import(base+"firebase-app.js"),import(base+"firebase-auth.js"),import(base+"firebase-firestore.js")]);
    const app=initializeApp(window.FIREBASE_CONFIG), auth=A.getAuth(app), db=F.getFirestore(app);
    const T=id=>F.doc(db,"tournaments",id);
    let tid=null,unsubT=null,unsubAux=null,unsubReg=null,unsubMyReg=null,lastData=null,roleKey=null,auxKey=null,firstAuth=true;
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
        // registrations: the admin sees all of them, everyone signed in sees their own
        if(unsubReg){unsubReg();unsubReg=null}if(unsubMyReg){unsubMyReg();unsubMyReg=null}
        if(tid&&r==="admin")unsubReg=F.onSnapshot(F.collection(db,"tournaments",tid,"entries"),s=>window.__setEntries(s.docs.map(d=>({uid:d.id,...d.data()}))),()=>{});
        else window.__setEntries([]);
        if(tid&&u)unsubMyReg=F.onSnapshot(F.doc(db,"tournaments",tid,"entries",u.uid),s=>window.__setMyEntry(s.exists()?{uid:s.id,...s.data()}:null),()=>window.__setMyEntry(null));
        else window.__setMyEntry(null);
      }
    }
    function leave(){if(unsubT){unsubT();unsubT=null}if(unsubAux){unsubAux();unsubAux=null}if(unsubReg){unsubReg();unsubReg=null}if(unsubMyReg){unsubMyReg();unsubMyReg=null}tid=null;lastData=null;roleKey=null;auxKey=null}

    // What the home page needs to show a tournament card
    const summary=(id,x,u)=>({id,name:x.name||"Tournament",teams:(x.teams||[]).length,style:x.style||"groups_ko",visibility:x.visibility||"public",
      date:(x.settings||{}).date||"",venue:(x.settings||{}).venue||"",start:(x.settings||{}).start||"",results:Object.keys(x.scores||{}).length,regOpen:!!x.regOpen,
      createdAt:x.createdAt||0,updatedAt:x.updatedAt||0,role:u?((x.members||{})[u.uid]||"editor"):null,owner:!!u&&x.ownerUid===u.uid});
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
          const d=window.__defaults(opts.teams||8,opts.style);
          for(let i=0;i<6;i++){
            const id=genId();
            if((await F.getDoc(T(id))).exists())continue;
            const doc={name,ownerUid:u.uid,members:{[u.uid]:"admin"},memberUids:[u.uid],teams:d.teams,style:opts.style||"groups_ko",visibility:opts.visibility==="private"?"private":"public",bestOf:{},settings:d.settings,sfPairing:0,scores:{},createdAt:Date.now(),updatedAt:Date.now()};
            // Duplicate: same teams, players, courts and settings; no scores, no date, only you as admin
            if(opts.copy){const c=opts.copy;Object.assign(doc,{teams:c.teams||doc.teams,style:c.style||doc.style,visibility:c.visibility||doc.visibility,bestOf:c.bestOf||{},settings:{...(c.settings||{}),date:""},teamPlayers:c.teamPlayers||{},playerUids:c.playerUids||[]})}
            await F.setDoc(T(id),doc);
            return {ok:true,id}
          }
          return {ok:false,error:"id-collision"}
        }catch(e){return {ok:false,error:err(e)}}
      },
      async listMine(){
        const u=auth.currentUser;if(!u)return {ok:true,list:[]};
        try{
          const s=await F.getDocs(F.query(F.collection(db,"tournaments"),F.where("memberUids","array-contains",u.uid)));
          const list=s.docs.map(d=>summary(d.id,d.data(),u)).sort((a,b)=>b.createdAt-a.createdAt);
          return {ok:true,list}
        }catch(e){return {ok:false,error:err(e)}}
      },
      async listPublic(){
        try{
          const s=await F.getDocs(F.query(F.collection(db,"tournaments"),F.where("visibility","==","public"),F.limit(100)));
          const list=s.docs.map(d=>summary(d.id,d.data(),null));
          return {ok:true,list}
        }catch(e){return {ok:false,error:err(e)}}
      },
      // Player profiles (profiles/{uid}); private ones can only be read by their owner
      async getProfile(uid){
        try{const s=await F.getDoc(F.doc(db,"profiles",uid));return {ok:true,profile:s.exists()?{uid,...s.data()}:null}}
        catch(e){return e.code==="permission-denied"?{ok:true,profile:null,private:true}:{ok:false,error:err(e)}}
      },
      async saveProfile(data){
        const u=auth.currentUser;if(!u)return {ok:false,error:"not signed in"};
        try{await F.setDoc(F.doc(db,"profiles",u.uid),{...data,updatedAt:Date.now()});return {ok:true}}
        catch(e){return {ok:false,error:err(e)}}
      },
      async listPublicProfiles(){
        try{
          const s=await F.getDocs(F.query(F.collection(db,"profiles"),F.where("visibility","==","public"),F.limit(500)));
          return {ok:true,list:s.docs.map(d=>({uid:d.id,...d.data()}))}
        }catch(e){return {ok:false,error:err(e)}}
      },
      // Tournaments a player was added to (for the profile's matches and statistics)
      async tournamentsOfPlayer(uid){
        try{
          const s=await F.getDocs(F.query(F.collection(db,"tournaments"),F.where("playerUids","array-contains",uid),F.limit(100)));
          return {ok:true,list:s.docs.map(d=>({id:d.id,...d.data()}))}
        }catch(e){return {ok:false,error:err(e)}}
      },
      // Marketplace listings (newest first)
      async listListings(){
        try{
          const s=await F.getDocs(F.query(F.collection(db,"listings"),F.orderBy("createdAt","desc"),F.limit(200)));
          return {ok:true,list:s.docs.map(d=>({id:d.id,...d.data()}))}
        }catch(e){return {ok:false,error:err(e)}}
      },
      async createListing(data){
        const u=auth.currentUser;if(!u)return {ok:false,error:"not signed in"};
        try{const ref=await F.addDoc(F.collection(db,"listings"),{...data,ownerUid:u.uid,createdAt:Date.now(),updatedAt:Date.now()});return {ok:true,id:ref.id}}
        catch(e){return {ok:false,error:err(e)}}
      },
      async updateListing(id,data){
        try{await F.updateDoc(F.doc(db,"listings",id),{...data,updatedAt:Date.now()});return {ok:true}}
        catch(e){return {ok:false,error:err(e)}}
      },
      // Reports on listings: anyone signed in can report; only the site admin can read and clear them
      async reportListing(listingId,reason){
        const u=auth.currentUser;if(!u)return {ok:false,error:"not signed in"};
        try{await F.addDoc(F.collection(db,"reports"),{listingId,reason,reporterUid:u.uid,createdAt:Date.now()});return {ok:true}}
        catch(e){return {ok:false,error:err(e)}}
      },
      async listReports(){
        try{const s=await F.getDocs(F.query(F.collection(db,"reports"),F.orderBy("createdAt","desc"),F.limit(100)));return {ok:true,list:s.docs.map(d=>({id:d.id,...d.data()}))}}
        catch(e){return {ok:false,error:err(e)}}
      },
      async dismissReport(id){
        try{await F.deleteDoc(F.doc(db,"reports",id));return {ok:true}}catch(e){return {ok:false,error:err(e)}}
      },
      async deleteListing(id){
        try{await F.deleteDoc(F.doc(db,"listings",id));return {ok:true}}
        catch(e){return {ok:false,error:err(e)}}
      },
      async getTournament(id){
        try{const s=await F.getDoc(T(id));return s.exists()?{ok:true,data:s.data()}:{ok:false,error:"not-found"}}catch(e){return {ok:false,error:err(e)}}
      },
      // Pending edit-access requests (admins only) – for the badge on the home page
      async pendingRequests(id){
        try{const s=await F.getDocs(F.query(F.collection(db,"tournaments",id,"requests"),F.where("status","==","pending"),F.limit(20)));return {ok:true,n:s.size}}catch(e){return {ok:false,n:0}}
      },
      // Only the owner may delete (see firestore.rules)
      async deleteTournament(id){
        try{await F.deleteDoc(T(id));return {ok:true}}catch(e){return {ok:false,error:err(e)}}
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
      // Registrations (tournaments/{tid}/entries/{uid}); see js/register.js
      async register(data){
        const u=auth.currentUser;if(!u||!tid)return {ok:false,error:"not signed in"};
        try{await F.setDoc(F.doc(db,"tournaments",tid,"entries",u.uid),data);return {ok:true}}catch(e){return {ok:false,error:err(e)}}
      },
      async cancelEntry(){
        const u=auth.currentUser;if(!u||!tid)return {ok:false,error:"not signed in"};
        try{await F.deleteDoc(F.doc(db,"tournaments",tid,"entries",u.uid));return {ok:true}}catch(e){return {ok:false,error:err(e)}}
      },
      async updateEntry(uid,upd){
        if(!tid)return {ok:false,error:"no tournament"};
        try{await F.updateDoc(F.doc(db,"tournaments",tid,"entries",uid),upd);return {ok:true}}catch(e){return {ok:false,error:err(e)}}
      },
      async deleteEntry(uid){
        if(!tid)return {ok:false,error:"no tournament"};
        try{await F.deleteDoc(F.doc(db,"tournaments",tid,"entries",uid));return {ok:true}}catch(e){return {ok:false,error:err(e)}}
      },
      // The partner (from an invite link) puts their own account on the registration
      async claimPartner(regUid,partner){
        if(!tid)return {ok:false,error:"no tournament"};
        try{await F.updateDoc(F.doc(db,"tournaments",tid,"entries",regUid),{partner,updatedAt:Date.now()});return {ok:true}}catch(e){return {ok:false,error:err(e)}}
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
      window.__authState(u?{email:u.email,uid:u.uid,displayName:u.displayName||"",photoURL:u.photoURL||""}:null);
      if(tid)pushRole();
      if(firstAuth){firstAuth=false;window.__cloudReady()}
    });
  }catch(e){
    window.__toast("Could not connect to the online service. Check the Firebase settings.");
    console.error(e);
  }
}

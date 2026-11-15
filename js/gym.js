// Training: each player sets how many days a week they go to the gym and what they do on each day,
// builds their own routines, logs workouts (sets, weights, rest timer) and padel sessions, and follows their progress.
// Signed in: saved in gym/{uid} (plan + routines) and gym/{uid}/log (sessions), readable only by the owner.
// Not signed in: saved in this browser; it moves into the account at the first sign-in.
(function(){
"use strict";
const E=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const LSK="padelGym",DRK="padelGymDraft";
const ls={get(k){try{const v=localStorage.getItem(k);return v?JSON.parse(v):null}catch(e){return null}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}},del(k){try{localStorage.removeItem(k)}catch(e){}}};

/* ---------- exercise demos: stick figures moving between two poses ---------- */
function parse(s,o){const t=s.trim().split(/\s+/);for(let i=0;i+2<t.length;i+=3)o[t[i]]=[+t[i+1],+t[i+2]];return o}
function P(s,base){const o={};if(base){const b=typeof base==="string"?parse(base,{}):base;for(const k in b)o[k]=[b[k][0],b[k][1]]}return parse(s||"",o)}
const SS="hd 58 20 n 58 30 h 58 60 le 59 45 lh 59 60 re 61 45 rh 61 60 lk 58 84 lf 57 108 rk 61 84 rf 61 108";
const FS="hd 60 20 n 60 30 h 60 60 le 51 45 lh 49 59 re 69 45 rh 71 59 lk 55 84 lf 53 108 rk 65 84 rf 67 108";
const PL="hd 91 76 n 82 80 h 52 90 le 81 94 lh 81 108 re 83 94 rh 83 108 lk 37 98 lf 22 106 rk 38 98 rf 23 106";
const BENCH_A="hd 88 80 n 76 83 h 46 85 le 68 96 lh 73 80 re 70 96 rh 75 80 lk 28 78 lf 26 106 rk 30 78 rf 28 106";
const ROW_A="hd 84 55 n 74 58 h 44 56 le 76 67 lh 78 76 re 74 73 rh 74 88 lk 50 76 lf 28 76 rk 40 82 rf 38 108";
const HK_A="hd 58 38 n 58 48 h 58 78 le 52 60 lh 56 72 re 64 62 rh 63 47 lk 52 104 lf 30 106 rk 76 80 rf 76 108";
const SP_A="hd 90 74 n 80 80 h 54 94 le 80 104 lh 94 106 re 70 84 rh 60 90 lk 39 101 lf 22 106 rk 40 100 rf 23 105";
const SQ="hd 62 42 n 56 52 h 44 80 le 62 66 lh 68 56 re 64 66 rh 70 56 lk 66 84 lf 57 108 rk 70 84 rf 61 108";

const EX={
goblet:{name:"Goblet Squat",mus:"Quads, glutes, core",type:"weight",cat:"legs",A:P("le 64 44 lh 68 36 re 66 44 rh 70 36",SS),B:P(SQ),eq:[{t:"dbv"}],
 cues:["Hold the dumbbell or kettlebell at your chest, elbows pointing down.","Sit your hips down between your heels, chest tall.","Drive through the whole foot to stand back up."]},
rdl:{name:"Romanian Deadlift",mus:"Hamstrings, glutes, lower back",type:"weight",cat:"legs",A:P(SS),B:P("hd 85 46 n 76 50 h 48 62 le 75 65 lh 75 80 re 77 65 rh 77 80 lk 52 85 lf 55 108 rk 55 85 rf 58 108"),eq:[{t:"db",at:"lh"},{t:"db",at:"rh"}],
 cues:["Soft knees and a flat back the whole time.","Push your hips back until you feel a stretch in the hamstrings.","Squeeze your glutes to stand tall, weights close to your legs."]},
latlunge:{name:"Lateral Lunge",mus:"Adductors, glutes, quads",type:"weight",cat:"legs",A:P("le 52 44 lh 58 40 re 68 44 rh 62 40",FS),B:P("hd 66 38 n 67 48 h 70 76 le 60 62 lh 66 56 re 74 62 rh 70 56 lk 52 92 lf 34 108 rk 90 86 rf 96 108"),eq:[],
 cues:["Big step out to the side, toes pointing forward.","Sit back into that hip, the other leg stays straight.","Push off hard to return. This is your padel side-step."]},
skater:{name:"Lateral Bounds (Skaters)",mus:"Glutes, calves, agility",type:"reps",cat:"legs",hop:10,A:P("hd 47 28 n 46 38 h 42 68 le 54 48 lh 58 58 re 34 44 rh 28 52 lk 36 88 lf 38 108 rk 50 90 rf 28 102"),B:P("hd 73 28 n 74 38 h 78 68 le 86 44 lh 92 52 re 66 48 rh 62 58 lk 70 90 lf 92 102 rk 84 88 rf 82 108"),eq:[],
 cues:["Leap sideways from one leg to the other.","Land softly on the outside leg, the other foot crosses behind.","Hold the landing for 1 second before the next bound."]},
jumpsquat:{name:"Jump Squat",mus:"Legs, power",type:"reps",cat:"legs",A:P("le 50 62 lh 42 70 re 52 63 rh 44 71",SQ),B:P("hd 58 6 n 58 16 h 58 46 le 66 22 lh 76 16 re 67 23 rh 77 17 lk 58 70 lf 57 94 rk 61 70 rf 61 94"),eq:[],
 cues:["Squat down, arms swing back.","Jump explosively, arms swing forward.","Land softly and sink straight into the next rep."]},
pullup:{name:"Pull-up / Lat Pulldown",mus:"Lats, biceps",type:"bw",cat:"upper",noGround:true,A:P("hd 60 30 n 60 40 h 60 70 le 48 26 lh 44 12 re 72 26 rh 76 12 lk 57 92 lf 58 112 rk 63 92 rf 62 112"),B:P("hd 60 8 n 60 19 h 60 50 le 38 24 lh 44 12 re 82 24 rh 76 12 lk 57 72 lf 56 92 rk 63 72 rf 64 92"),eq:[],st:[{t:"bar"}],
 cues:["Hang with straight arms, shoulders pulled down.","Pull your elbows down to your ribs until your chin passes the bar.","Lower slowly. On the lat pulldown, log the machine weight as extra kg."]},
dbbench:{name:"Dumbbell Bench Press",mus:"Chest, triceps, shoulders",type:"weight",cat:"upper",A:P(BENCH_A),B:P("le 75 68 lh 75 54 re 77 68 rh 77 54",BENCH_A),eq:[{t:"db",at:"lh"},{t:"db",at:"rh"}],st:[{t:"bench",x1:34,x2:92,y:89,legs:[40,86]}],
 cues:["Squeeze your shoulder blades together, feet planted.","Lower the dumbbells to chest level, elbows at about 45°.","Press up and slightly in. Log the weight of one dumbbell."]},
dbrow:{name:"Single-Arm Dumbbell Row",mus:"Upper back, lats, biceps",type:"weight",cat:"upper",A:P(ROW_A),B:P("re 62 48 rh 64 63",ROW_A),eq:[{t:"db",at:"rh"}],st:[{t:"bench",x1:24,x2:90,y:79,legs:[30,84]}],
 cues:["Knee and hand on the bench, back flat like a table.","Pull the dumbbell to your hip, elbow close to your body.","Lower with control. Log reps per side."]},
hkpress:{name:"Half-Kneeling Shoulder Press",mus:"Shoulders, core",type:"weight",cat:"upper",A:P(HK_A),B:P("re 60 34 rh 60 19",HK_A),eq:[{t:"db",at:"rh"}],
 cues:["One knee down, squeeze the glute of the down leg.","Press the dumbbell straight overhead, ribs down.","Don’t lean back. Good for your smash shoulder."]},
pushup:{name:"Push-up",mus:"Chest, triceps",type:"reps",cat:"upper",A:P(PL),B:P("hd 92 93 n 82 98 h 52 100 le 72 100 re 74 101 lk 37 103 rk 38 103",PL),eq:[],
 cues:["Hands under shoulders, body in one straight line.","Lower your chest to just above the floor.","Push back up. Dropping to your knees is fine to finish reps."]},
extrot:{name:"Band External Rotation",mus:"Rotator cuff",type:"reps",cat:"upper",A:P("re 68 50 rh 54 54",FS),B:P("re 68 50 rh 84 46",FS),eq:[{t:"band",from:[6,52],to:"rh"}],
 cues:["Elbow pinned to your side, bent 90°.","Rotate your forearm outward against the band.","Slow and light. This protects the shoulder."]},
medball:{name:"Med Ball Rotational Throw",mus:"Obliques, hips, shoulders",type:"weight",cat:"core",A:P("hd 56 21 n 57 31 le 48 46 lh 42 58 re 54 48 rh 44 60 lk 52 84 lf 46 108 rk 68 84 rf 74 108",FS),B:P("hd 64 21 n 63 31 le 72 36 lh 86 34 re 74 38 rh 88 36 lk 52 84 lf 46 108 rk 68 84 rf 74 108",FS),eq:[{t:"ball"}],st:[{t:"wall",x:106}],
 cues:["Stand side-on to a wall, ball at your back hip.","Rotate from the hips first, then the arms, like a forehand.","Throw hard, catch, reset. Do both sides. Log the ball weight."]},
pallof:{name:"Pallof Press",mus:"Core (anti-rotation)",type:"reps",cat:"core",A:P("le 48 48 lh 60 44 re 72 48 rh 60 44",FS),B:P("le 55 42 lh 60 41 re 65 42 rh 60 41",FS),eq:[{t:"band",from:[6,44],to:"mid"}],
 cues:["Stand side-on to the anchor, band at your chest.","Press your hands straight out in front and hold for 2 seconds.","Don’t let the band twist you. Brace your core."]},
woodchop:{name:"Cable / Band Woodchop",mus:"Obliques, core",type:"weight",cat:"core",A:P("hd 56 21 n 58 31 h 60 60 le 46 22 lh 36 14 re 48 24 rh 38 16 lk 52 84 lf 46 108 rk 68 84 rf 74 108"),B:P("hd 63 25 n 63 35 h 60 64 le 72 52 lh 82 66 re 74 54 rh 84 68 lk 53 86 lf 46 108 rk 69 86 rf 74 108"),eq:[{t:"band",from:[6,6],to:"mid"}],
 cues:["Start with the handle high on one side.","Pull diagonally down across your body to the opposite hip.","Rotate through your hips and pivot the back foot."]},
sideplank:{name:"Side Plank",mus:"Obliques, core",type:"time",cat:"core",A:P(SP_A),B:P("h 54 86 lk 39 97 rk 40 96 re 82 66 rh 84 52",SP_A),eq:[],
 cues:["Elbow under your shoulder, feet stacked.","Lift your hips so your body forms a straight line.","Hold, then switch sides."]},
kbswing:{name:"Kettlebell Swing",mus:"Glutes, hamstrings, cardio",type:"weight",cat:"cond",A:P("hd 81 44 n 72 48 h 46 62 le 67 63 lh 60 76 re 68 64 rh 61 77 lk 51 84 lf 55 108 rk 54 84 rf 58 108"),B:P("le 71 35 lh 85 37 re 72 36 rh 86 38",SS),eq:[{t:"kb",at:"rh"}],
 cues:["Hike the bell back between your legs. Hinge, don’t squat.","Snap your hips forward hard, glutes tight.","Your arms only guide the bell up to chest height."]},
burpee:{name:"Burpee",mus:"Full body, cardio",type:"reps",cat:"cond",A:P("le 60 18 lh 62 6 re 62 18 rh 64 6",SS),B:P(PL),eq:[],
 cues:["Drop your hands to the floor and jump your feet back to a plank.","Jump your feet back in.","Explode up into a jump with arms overhead."]},
climber:{name:"Mountain Climbers",mus:"Core, cardio",type:"time",cat:"cond",A:P("h 54 88 lk 38 97 lf 22 106 rk 72 94 rf 64 106",PL),B:P("h 54 88 lk 72 94 lf 64 106 rk 38 97 rf 22 106",PL),eq:[],
 cues:["Strong plank, shoulders over hands.","Drive your knees to your chest, one after the other.","Keep your hips low and move fast."]},
/* legs */
backsquat:{name:"Barbell Back Squat",mus:"Quads, glutes, core",type:"weight",cat:"legs",A:P("le 50 42 lh 54 32 re 52 42 rh 56 32",SS),B:P("le 46 58 lh 52 46 re 48 58 rh 54 46",SQ),eq:[{t:"plate",at:"n",dx:-2,dy:2}],
 cues:["Bar on your upper back, hands just outside your shoulders.","Brace your core, then sit down and back until your thighs are at least parallel.","Knees follow your toes. Drive up through the whole foot."]},
deadlift:{name:"Barbell Deadlift",mus:"Hamstrings, glutes, back",type:"weight",cat:"legs",A:P("hd 80 52 n 72 56 h 46 70 le 71 72 lh 70 90 re 73 72 rh 72 90 lk 60 86 lf 57 108 rk 63 86 rf 61 108"),B:P(SS),eq:[{t:"plate",at:"mid",dy:8}],
 cues:["Bar over the middle of your feet, shins close to it.","Flat back, chest up, take the slack out of the bar.","Push the floor away and stand tall. Lower it the same way."]},
bulgarian:{name:"Bulgarian Split Squat",mus:"Quads, glutes, balance",type:"weight",cat:"legs",
 A:P("hd 64 22 n 64 32 h 62 62 le 63 47 lh 63 62 re 65 47 rh 65 62 lk 46 76 lf 30 82 rk 70 84 rf 72 108"),B:P("hd 62 40 n 62 50 h 58 80 le 61 65 lh 61 80 re 63 65 rh 63 80 lk 44 98 lf 30 82 rk 76 86 rf 74 108"),
 eq:[{t:"db",at:"lh"},{t:"db",at:"rh"}],st:[{t:"bench",x1:14,x2:40,y:84,legs:[18,36]}],
 cues:["Back foot on the bench, front foot far enough forward.","Lower straight down until the back knee nearly touches the floor.","Push through the front heel. Do all reps, then switch legs."]},
revlunge:{name:"Reverse Lunge",mus:"Quads, glutes",type:"weight",cat:"legs",A:P(SS),B:P("hd 56 36 n 56 46 h 56 76 le 57 61 lh 57 76 re 59 61 rh 59 76 lk 44 100 lf 30 108 rk 72 80 rf 70 108"),eq:[{t:"db",at:"lh"},{t:"db",at:"rh"}],
 cues:["Step one foot back and lower both knees to 90°.","Keep your chest up and the front knee over the foot.","Push back to standing. Alternate legs."]},
hipthrust:{name:"Hip Thrust",mus:"Glutes, hamstrings",type:"weight",cat:"legs",
 A:P("hd 30 60 n 40 66 h 60 96 le 50 80 lh 60 92 re 51 81 rh 61 93 lk 80 82 lf 86 108 rk 81 82 rf 87 108"),B:P("hd 30 60 n 40 66 h 64 70 le 52 74 lh 62 68 re 53 75 rh 63 69 lk 84 74 lf 86 108 rk 85 74 rf 87 108"),
 eq:[{t:"plate",at:"h",dy:-10}],st:[{t:"bench",x1:16,x2:46,y:70,legs:[20,42]}],
 cues:["Upper back on the bench, bar across your hips.","Drive your hips up until your body is straight from shoulders to knees.","Squeeze your glutes at the top, chin tucked."]},
stepup:{name:"Step-up",mus:"Quads, glutes",type:"weight",cat:"legs",
 A:P("hd 44 20 n 44 30 h 44 60 le 45 45 lh 45 60 re 47 45 rh 47 60 lk 44 84 lf 44 108 rk 62 70 rf 68 94"),B:P("hd 68 6 n 68 16 h 68 46 le 69 31 lh 69 46 re 71 31 rh 71 46 lk 60 70 lf 56 92 rk 68 70 rf 68 94"),
 eq:[{t:"db",at:"lh"},{t:"db",at:"rh"}],st:[{t:"box",x:58,y:94,w:40}],
 cues:["Whole foot on the box.","Push through that leg to stand up on the box, don’t push off the back foot.","Step down with control. Do both legs."]},
calfraise:{name:"Calf Raise",mus:"Calves",type:"weight",cat:"legs",A:P(SS),B:P("hd 58 13 n 58 23 h 58 53 le 59 38 lh 59 53 re 61 38 rh 61 53 lk 58 77 lf 60 104 rk 61 77 rf 63 104"),eq:[{t:"db",at:"lh"},{t:"db",at:"rh"}],
 cues:["Stand tall, weight on the balls of your feet.","Rise as high as you can and hold for a second.","Lower slowly. Your calves power your first step on court."]},
boxjump:{name:"Box Jump",mus:"Legs, explosive power",type:"reps",cat:"legs",hop:8,
 A:P("hd 40 42 n 34 52 h 22 80 le 26 62 lh 18 70 re 28 63 rh 20 71 lk 44 84 lf 35 108 rk 48 84 rf 39 108"),B:P("hd 90 22 n 86 32 h 76 60 le 96 44 lh 104 38 re 98 45 rh 106 39 lk 96 66 lf 86 86 rk 98 66 rf 89 86"),
 eq:[],st:[{t:"box",x:72,y:86,w:36}],
 cues:["Swing your arms back and dip into a quarter squat.","Jump onto the box and land softly with bent knees.","Stand up, then step down. Don’t jump down."]},
/* upper body */
bbbench:{name:"Barbell Bench Press",mus:"Chest, triceps, shoulders",type:"weight",cat:"upper",A:P(BENCH_A),B:P("le 75 68 lh 75 54 re 77 68 rh 77 54",BENCH_A),eq:[{t:"plate",at:"mid"}],st:[{t:"bench",x1:34,x2:92,y:89,legs:[40,86]}],
 cues:["Eyes under the bar, shoulder blades squeezed, feet planted.","Lower the bar to your lower chest.","Press up in a straight line. Use a spotter for heavy sets."]},
ohp:{name:"Overhead Press",mus:"Shoulders, triceps, core",type:"weight",cat:"upper",A:P("le 60 42 lh 64 30 re 62 42 rh 66 30",SS),B:P("le 59 17 lh 59 6 re 61 17 rh 61 6",SS),eq:[{t:"plate",at:"mid"}],
 cues:["Bar on your front shoulders, elbows slightly forward.","Squeeze your glutes and press the bar straight up.","Move your head back, then through once the bar passes it."]},
bbrow:{name:"Bent-over Barbell Row",mus:"Upper back, lats, biceps",type:"weight",cat:"upper",
 A:P("hd 85 46 n 76 50 h 48 62 le 75 65 lh 75 80 re 77 65 rh 77 80 lk 52 85 lf 55 108 rk 55 85 rf 58 108"),B:P("hd 85 46 n 76 50 h 48 62 le 62 56 lh 68 66 re 64 56 rh 70 66 lk 52 85 lf 55 108 rk 55 85 rf 58 108"),eq:[{t:"plate",at:"mid"}],
 cues:["Hinge forward with a flat back, knees soft.","Pull the bar to your belly button, elbows back.","Lower with control without standing up."]},
curl:{name:"Dumbbell Biceps Curl",mus:"Biceps, forearms",type:"weight",cat:"upper",A:P(SS),B:P("lh 70 36 rh 72 35",SS),eq:[{t:"db",at:"lh"},{t:"db",at:"rh"}],
 cues:["Elbows stay at your sides.","Curl the dumbbells up without swinging.","Lower slowly all the way down."]},
dips:{name:"Bench Dips",mus:"Triceps, chest",type:"bw",cat:"upper",
 A:P("hd 48 28 n 46 38 h 46 64 le 44 50 lh 42 62 re 45 50 rh 43 62 lk 66 80 lf 82 106 rk 67 80 rf 83 106"),B:P("hd 48 42 n 46 52 h 46 80 le 30 56 lh 42 62 re 31 56 rh 43 62 lk 66 86 lf 82 106 rk 67 86 rf 83 106"),
 eq:[],st:[{t:"bench",x1:14,x2:44,y:64,legs:[18,40]}],
 cues:["Hands on the bench edge behind you, fingers forward.","Bend your elbows straight back until they reach about 90°.","Press back up. Bend your knees to make it easier."]},
latraise:{name:"Lateral Raise",mus:"Side shoulders",type:"weight",cat:"upper",A:P("le 53 45 lh 52 59 re 67 45 rh 68 59",FS),B:P("le 46 32 lh 32 32 re 74 32 rh 88 32",FS),eq:[{t:"db",at:"lh"},{t:"db",at:"rh"}],
 cues:["Light dumbbells, a small bend in the elbows.","Raise your arms out to the sides up to shoulder height.","Lower slowly. Don’t shrug."]},
facepull:{name:"Face Pull",mus:"Rear shoulders, rotator cuff",type:"weight",cat:"upper",A:P("le 72 32 lh 86 30 re 74 32 rh 88 30",SS),B:P("le 50 30 lh 64 24 re 52 30 rh 66 24",SS),eq:[{t:"band",from:[112,28],to:"mid"}],
 cues:["Cable or band at face height, thumbs pointing back.","Pull towards your forehead, elbows high and wide.","Squeeze your shoulder blades. Keeps your shoulders healthy for overheads."]},
/* core */
plank:{name:"Plank",mus:"Core, shoulders",type:"time",cat:"core",
 A:P("hd 92 86 n 82 90 h 52 92 le 82 106 lh 94 106 re 84 106 rh 96 106 lk 37 98 lf 22 106 rk 38 98 rf 23 106"),B:P("hd 92 86 n 82 90 h 52 89 le 82 106 lh 94 106 re 84 106 rh 96 106 lk 37 97 lf 22 106 rk 38 97 rf 23 106"),eq:[],
 cues:["Forearms under your shoulders, body in one straight line.","Squeeze your glutes and pull your belly button in.","Breathe and hold. Stop when your hips start to sag."]},
deadbug:{name:"Dead Bug",mus:"Deep core",type:"reps",cat:"core",
 A:P("hd 92 100 n 82 101 h 52 102 le 82 87 lh 82 73 re 83 87 rh 83 73 lk 52 78 lf 32 78 rk 53 78 rf 33 78"),B:P("hd 92 100 n 82 101 h 52 102 le 82 87 lh 82 73 re 96 94 rh 110 98 lk 38 94 lf 18 100 rk 53 78 rf 33 78"),eq:[],
 cues:["Lie on your back, arms up, knees bent at 90° above your hips.","Lower one arm and the opposite leg towards the floor.","Keep your lower back pressed down. Alternate sides."]},
russian:{name:"Russian Twist",mus:"Obliques",type:"reps",cat:"core",
 A:P("hd 72 62 n 66 72 h 50 102 le 68 86 lh 80 92 re 70 86 rh 81 93 lk 72 84 lf 90 98 rk 73 84 rf 91 98"),B:P("hd 74 62 n 68 72 h 50 102 le 76 72 lh 86 80 re 78 72 rh 87 80 lk 72 84 lf 90 98 rk 73 84 rf 91 98"),eq:[{t:"ball"}],
 cues:["Sit leaning back, feet off the floor if you can.","Rotate your shoulders to bring the ball beside one hip, then the other.","Move from your trunk, not only your arms."]},
kneeraise:{name:"Hanging Knee Raise",mus:"Lower abs, grip",type:"reps",cat:"core",noGround:true,
 A:P("hd 60 30 n 60 40 h 60 70 le 60 26 lh 60 12 re 61 26 rh 61 12 lk 60 94 lf 60 116 rk 61 94 rf 61 116"),B:P("hd 58 30 n 59 40 h 62 70 le 60 26 lh 60 12 re 61 26 rh 61 12 lk 80 64 lf 82 88 rk 81 64 rf 83 88"),eq:[],st:[{t:"bar"}],
 cues:["Hang from the bar, shoulders active.","Bring your knees up to your chest without swinging.","Lower slowly."]},
/* conditioning */
shuffle:{name:"Lateral Shuffle",mus:"Legs, footwork",type:"time",cat:"cond",
 A:P("hd 48 30 n 48 40 h 48 68 le 40 52 lh 36 62 re 56 52 rh 60 62 lk 38 86 lf 32 108 rk 58 86 rf 62 108"),B:P("hd 72 30 n 72 40 h 72 68 le 64 52 lh 60 62 re 80 52 rh 84 62 lk 64 86 lf 60 108 rk 80 86 rf 84 108"),eq:[],
 cues:["Low athletic stance, like waiting for a return.","Shuffle sideways quickly without crossing your feet.","Touch a line or cone and shuffle back."]},
jumprope:{name:"Jump Rope",mus:"Calves, cardio, timing",type:"time",cat:"cond",hop:6,A:P("le 50 50 lh 44 62 re 70 50 rh 76 62",FS),B:P("le 50 49 lh 45 60 re 70 49 rh 75 60",FS),eq:[{t:"rope"}],
 cues:["Elbows close to your sides, turn the rope with your wrists.","Small, quick jumps on the balls of your feet.","Stay relaxed. Great footwork training for padel."]},
farmer:{name:"Farmer’s Carry",mus:"Grip, core, traps",type:"weight",cat:"cond",A:P("lk 52 84 lf 46 108 rk 66 84 rf 72 108",SS),B:P("lk 66 84 lf 72 108 rk 52 84 rf 46 108",SS),eq:[{t:"db",at:"lh"},{t:"db",at:"rh"}],
 cues:["Heavy dumbbells or kettlebells at your sides.","Walk tall with short, quick steps.","Don’t lean. Log the weight of one dumbbell and the distance or time in your notes."]},
/* warm-up */
armcircle:{name:"Arm Circles",mus:"Shoulders",type:"time",cat:"warm",A:P("le 44 32 lh 30 32 re 76 32 rh 90 32",FS),B:P("le 46 18 lh 40 6 re 74 18 rh 80 6",FS),eq:[],
 cues:["Arms out to the sides.","Make small circles forward, then bigger ones.","Repeat backwards."]},
legswing:{name:"Leg Swings",mus:"Hips, hamstrings",type:"reps",cat:"warm",A:P("rk 74 78 rf 90 94",SS),B:P("rk 46 80 rf 36 102",SS),eq:[],
 cues:["Hold on to something for balance.","Swing one leg forward and back, relaxed.","Then swing it side to side. Do both legs."]},
worldstretch:{name:"Lunge with Rotation",mus:"Hips, thoracic spine",type:"reps",cat:"warm",
 A:P("hd 66 46 n 64 56 h 52 78 le 70 72 lh 72 88 re 72 70 rh 74 86 lk 40 100 lf 24 108 rk 72 82 rf 72 108"),B:P("hd 66 44 n 64 54 h 52 78 le 70 72 lh 72 88 re 66 40 rh 70 24 lk 40 100 lf 24 108 rk 72 82 rf 72 108"),eq:[],
 cues:["Long lunge, both hands on the floor inside the front foot.","Rotate and reach the inside arm up to the ceiling.","Hold 2 seconds, back down. Switch sides."]},
pullapart:{name:"Band Pull-Apart",mus:"Rear shoulders, upper back",type:"reps",cat:"warm",A:P("le 54 36 lh 56 38 re 66 36 rh 64 38",FS),B:P("le 44 32 lh 28 32 re 76 32 rh 92 32",FS),eq:[{t:"bandh"}],
 cues:["Arms straight out at shoulder height.","Pull the band apart until it touches your chest.","Squeeze your shoulder blades, return slowly."]}
};
const CATS=[["all","All"],["legs","Legs"],["upper","Upper body"],["core","Core"],["cond","Conditioning"],["warm","Warm-up"],["mine","My exercises"]];
const TYPES=[["weight","Weight × reps"],["bw","Bodyweight × reps (extra kg optional)"],["reps","Reps only"],["time","Time (seconds)"]];
// Ready-made routines: [exercise, sets, reps, rest in seconds]
const TPL={
padel:{name:"Padel strength, 2 days a week",desc:"Gym A for power and legs, Gym B for upper body and core. Built around the movements of padel.",days:[0,3],routines:[
  {name:"Gym A",note:"Warm-up: 5 min skipping or rowing, leg swings, hip circles",ex:[["goblet",4,"6–8",120],["rdl",3,"8",90],["latlunge",3,"8/side",90],["medball",3,"6/side",60],["skater",3,"6/side",60]]},
  {name:"Gym B",note:"Warm-up: band pull-aparts, arm circles, 5 min row",ex:[["pullup",4,"8",90],["dbbench",4,"8",90],["dbrow",3,"10/side",75],["hkpress",3,"8/side",75],["extrot",3,"12",45],["pallof",3,"10/side",45],["woodchop",3,"10/side",45]]}]},
full:{name:"Full body, 3 days a week",desc:"One routine for the whole body, done three times a week. Good for getting started.",days:[0,2,4],routines:[
  {name:"Full body",note:"Warm-up: 5 min easy cardio, band pull-aparts",ex:[["goblet",3,"10",90],["dbbench",3,"10",90],["dbrow",3,"10/side",75],["rdl",3,"10",90],["pallof",3,"10/side",45],["sideplank",2,"30 s/side",45]]}]},
split:{name:"Upper / lower, 4 days a week",desc:"Classic barbell strength: two lower-body days and two upper-body days. For players who already know the main lifts.",days:[0,1,3,4],routines:[
  {name:"Lower body",note:"Warm-up: leg swings, lunges with rotation, 2 light squat sets",ex:[["backsquat",4,"6",150],["deadlift",3,"5",150],["bulgarian",3,"8/side",90],["hipthrust",3,"10",90],["calfraise",3,"15",60],["plank",3,"45 s",45]]},
  {name:"Upper body",note:"Warm-up: arm circles, band pull-aparts, 2 light bench sets",ex:[["bbbench",4,"6",150],["bbrow",4,"8",90],["ohp",3,"8",90],["pullup",3,"8",90],["curl",3,"12",60],["dips",3,"12",60],["facepull",3,"15",45]]}]},
cond:{name:"Court conditioning, 1 day a week",desc:"Short, hard session for speed and stamina on court. Add it to any plan.",days:[],routines:[
  {name:"Conditioning",note:"Work hard, rest short",ex:[["skater",4,"8/side",45],["jumpsquat",4,"10",45],["kbswing",4,"15",45],["burpee",3,"10",60],["climber",3,"30 s",45]]}]}
};

const f1=v=>v.toFixed(1);
function pose(ex,t){const o={},lift=ex.hop?ex.hop*Math.sin(Math.PI*t):0;for(const k in ex.A){const a=ex.A[k],b=ex.B[k]||a;o[k]=[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t-lift]}return o}
const mid=J=>[(J.lh[0]+J.rh[0])/2,(J.lh[1]+J.rh[1])/2];
function eqStatic(e){
 if(e.t==="bar")return '<line x1="26" y1="12" x2="94" y2="12" class="bar"/>';
 if(e.t==="box")return `<rect x="${e.x}" y="${e.y}" width="${e.w}" height="${110-e.y}" rx="2" class="box"/>`;
 if(e.t==="wall")return `<rect x="${e.x}" y="18" width="7" height="92" class="wall"/>`;
 if(e.t==="bench")return `<rect x="${e.x1}" y="${e.y}" width="${e.x2-e.x1}" height="6" rx="2" class="bench"/>`+e.legs.map(x=>`<line x1="${x}" y1="${e.y+6}" x2="${x}" y2="110" class="bl"/>`).join("");
 return "";
}
function eqDyn(e,J){
 let c;
 if(e.t==="db"){c=J[e.at];return `<line x1="${f1(c[0]-7)}" y1="${f1(c[1])}" x2="${f1(c[0]+7)}" y2="${f1(c[1])}" class="dbb"/><rect x="${f1(c[0]-10)}" y="${f1(c[1]-4.5)}" width="4" height="9" rx="1" class="dbp"/><rect x="${f1(c[0]+6)}" y="${f1(c[1]-4.5)}" width="4" height="9" rx="1" class="dbp"/>`}
 if(e.t==="dbv"){c=mid(J);return `<line x1="${f1(c[0])}" y1="${f1(c[1]-7)}" x2="${f1(c[0])}" y2="${f1(c[1]+7)}" class="dbb"/><rect x="${f1(c[0]-5)}" y="${f1(c[1]-10)}" width="10" height="4" rx="1" class="dbp"/><rect x="${f1(c[0]-5)}" y="${f1(c[1]+6)}" width="10" height="4" rx="1" class="dbp"/>`}
 if(e.t==="kb"){c=J[e.at];const el=J[e.at==="rh"?"re":"le"],dx=c[0]-el[0],dy=c[1]-el[1],L=Math.sqrt(dx*dx+dy*dy)||1,cx=c[0]+dx/L*8,cy=c[1]+dy/L*8;return `<line x1="${f1(c[0])}" y1="${f1(c[1])}" x2="${f1(cx)}" y2="${f1(cy)}" class="kbh"/><circle cx="${f1(cx)}" cy="${f1(cy)}" r="6.5" class="kb"/>`}
 // a barbell seen from the side: the plate
 if(e.t==="plate"){c=e.at==="mid"?mid(J):J[e.at];const x=c[0]+(e.dx||0),y=c[1]+(e.dy||0);return `<circle cx="${f1(x)}" cy="${f1(y)}" r="9" class="plate"/><circle cx="${f1(x)}" cy="${f1(y)}" r="2.5" class="platec"/>`}
 if(e.t==="rope")return `<path d="M${f1(J.lh[0])} ${f1(J.lh[1])}Q60 ${f1(Math.max(J.lf[1],J.rf[1])+14)} ${f1(J.rh[0])} ${f1(J.rh[1])}" class="rope"/>`;
 if(e.t==="ball"){c=mid(J);return `<circle cx="${f1(c[0]+2)}" cy="${f1(c[1])}" r="7" class="ball"/>`}
 if(e.t==="band"){c=e.to==="mid"?mid(J):J[e.to];return `<circle cx="${e.from[0]}" cy="${e.from[1]}" r="3" class="anc"/><line x1="${e.from[0]}" y1="${e.from[1]}" x2="${f1(c[0])}" y2="${f1(c[1])}" class="band"/>`}
 if(e.t==="bandh")return `<line x1="${f1(J.lh[0])}" y1="${f1(J.lh[1])}" x2="${f1(J.rh[0])}" y2="${f1(J.rh[1])}" class="band" style="stroke-width:3"/>`;
 return "";
}
function figInner(ex,t){
 const J=pose(ex,t),p=k=>f1(J[k][0])+","+f1(J[k][1]);
 let s=(ex.st||[]).map(eqStatic).join("");
 if(!ex.noGround)s+='<line x1="4" y1="110.5" x2="116" y2="110.5" class="gr"/>';
 s+=`<polyline points="${p("n")} ${p("le")} ${p("lh")}" class="far"/><polyline points="${p("h")} ${p("lk")} ${p("lf")}" class="far"/>`;
 s+=`<line x1="${f1(J.n[0])}" y1="${f1(J.n[1])}" x2="${f1(J.h[0])}" y2="${f1(J.h[1])}" class="tor"/><circle cx="${f1(J.hd[0])}" cy="${f1(J.hd[1])}" r="7" class="hd"/>`;
 s+=`<polyline points="${p("h")} ${p("rk")} ${p("rf")}" class="near"/><polyline points="${p("n")} ${p("re")} ${p("rh")}" class="near"/>`;
 return s+(ex.eq||[]).map(e=>eqDyn(e,J)).join("");
}
// a custom exercise has no drawing: its initials instead
function fig(id,size){
 const ex=EX[id];
 if(!ex){const n=exName(id).split(/\s+/).filter(Boolean).slice(0,2).map(w=>w[0]).join("").toUpperCase()||"?";return `<span class="gx-init" style="width:${size}px;height:${size}px;font-size:${Math.round(size*.36)}px">${E(n)}</span>`}
 return `<svg class="fig" data-fig="${id}" viewBox="0 0 120 120" width="${size}" height="${size}" role="img" aria-label="${E(ex.name)}">${figInner(ex,0)}</svg>`;
}
let FIGS=[],lastF=0;
const still=window.matchMedia&&matchMedia("(prefers-reduced-motion: reduce)").matches;
function hydrate(){FIGS=[];document.querySelectorAll("#gymView svg[data-fig],#gymDlg svg[data-fig]").forEach(el=>FIGS.push({el,ex:EX[el.dataset.fig]}))}
function tick(ts){
 if(ts-lastF>40&&FIGS.length&&!still){lastF=ts;let t=.5-.5*Math.cos(2*Math.PI*((ts%2400)/2400));t=Math.max(0,Math.min(1,t*1.2-.1));
  FIGS.forEach(f=>{if(f.el.isConnected&&f.ex)f.el.innerHTML=figInner(f.ex,t)})}
 requestAnimationFrame(tick);
}

/* ---------- data ---------- */
let G=null,LOG=[],loadedFor=null,loadingFor=null,tab="plan",draft=ls.get(DRK),restEnd=0,restTotal=1;
let progEx=null,progMetric="top",libCat="all",expanded={},edit=null,pickFor=null,pickQ="",pf=null,saveT=null;
const blank=()=>({v:2,days:[],sched:{},routines:[],custom:{},updatedAt:0});
const signed=()=>!!(window.CLOUD_ON&&window.__cloud&&authUser);
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,6);
const clean=o=>JSON.parse(JSON.stringify(o));
const num=v=>{if(v===""||v==null)return null;const n=parseFloat(String(v).replace(",","."));return isNaN(n)?null:n};
const pad=n=>(n<10?"0":"")+n;
const ymd=d=>d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate());
const fromYmd=s=>{const a=s.split("-");return new Date(+a[0],+a[1]-1,+a[2],12)};
const WD=["Mon","Tue","Wed","Thu","Fri","Sat","Sun"],WDL=["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"],MN=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const wd=d=>(d.getDay()+6)%7;
const fmtD=ts=>{const d=new Date(ts);return WD[wd(d)]+", "+d.getDate()+" "+MN[d.getMonth()]};
const clock=sec=>{sec=Math.max(0,Math.floor(sec));const h=Math.floor(sec/3600),m=Math.floor(sec%3600/60),s=sec%60;return (h?h+":"+pad(m):m)+":"+pad(s)};
const weekStart=d=>{const x=new Date(d.getFullYear(),d.getMonth(),d.getDate());x.setDate(x.getDate()-wd(x));return x.getTime()};
const fmtKg=n=>n==null?"":String(Math.round(n*100)/100);
const exOf=id=>EX[id]||(G&&G.custom[id])||null;
function exName(id,fb){const x=exOf(id);return x?x.name:(fb||"Exercise")}
const exType=id=>(exOf(id)||{}).type||"weight";
const routine=id=>G.routines.find(r=>r.id===id)||null;
const sorted=()=>LOG.slice().sort((a,b)=>a.ts-b.ts);
const workouts=()=>sorted().filter(x=>x.kind==="w");
const padels=()=>sorted().filter(x=>x.kind==="p");
function setStr(type,s){if(type==="time")return (s.sec||0)+" s";if(type==="reps")return (s.reps||0)+" reps";if(type==="bw")return (s.kg?"+"+fmtKg(s.kg)+" kg × ":"")+(s.reps||0);return fmtKg(s.kg||0)+" kg × "+(s.reps||0)}
function prevSets(id){const w=workouts();for(let i=w.length-1;i>=0;i--){const e=w[i].exercises.find(x=>x.id===id);if(e)return e.sets}return null}
function metric(type,sets,m){
 let best=0,tot=0;sets.forEach(s=>{const kg=s.kg||0,r=s.reps||0,sec=s.sec||0;
  if(type==="weight"){if(m==="e1rm")best=Math.max(best,kg*(1+r/30));else if(m==="vol")tot+=kg*r;else best=Math.max(best,kg)}
  else if(type==="time"){if(m==="vol")tot+=sec;else best=Math.max(best,sec)}
  else{if(m==="vol")tot+=r;else best=Math.max(best,r+(kg?kg/100:0))}});
 return m==="vol"?tot:best;
}
function computePRs(w){return w.exercises.filter(e=>{const t=exType(e.id),now=metric(t,e.sets,"top");let had=false,prev=0;workouts().forEach(o=>o.exercises.forEach(x=>{if(x.id===e.id){had=true;prev=Math.max(prev,metric(t,x.sets,"top"))}}));return had&&now>prev}).map(e=>e.id)}
const volume=w=>Math.round(w.exercises.reduce((v,e)=>v+(exType(e.id)==="weight"?e.sets.reduce((a,s)=>a+(s.kg||0)*(s.reps||0),0):0),0));
// the weekly goal comes from the plan: every training day is a gym day unless it is set to padel
function goals(){let g=0,p=0;G.days.forEach(d=>{if(G.sched[d]==="padel")p++;else g++});return {g,p}}
function weekCounts(ws){const we=ws+7*864e5;let g=0,p=0;LOG.forEach(x=>{if(x.ts>=ws&&x.ts<we){if(x.kind==="w")g++;else p++}});return {g,p}}
const met=(c,gl)=>(gl.g||gl.p)&&c.g>=gl.g&&c.p>=gl.p;
function streak(){
 const gl=goals();if(!gl.g&&!gl.p)return 0;
 const ws=weekStart(new Date());let n=met(weekCounts(ws),gl)?1:0;
 for(let i=1;i<104;i++){if(met(weekCounts(weekStart(new Date(ws-i*7*864e5+3*864e5))),gl))n++;else break}
 return n;
}
function lastOf(rid){const w=workouts();for(let i=w.length-1;i>=0;i--)if(w[i].routine===rid)return w[i];return null}

/* ---------- load and save ---------- */
function readLocal(){const d=ls.get(LSK)||{};return {G:{...blank(),...(d.G||{})},log:Array.isArray(d.log)?d.log:[]}}
function persistLocal(){ls.set(LSK,{G,log:LOG})}
async function load(){
 const key=signed()?authUser.uid:"local";
 if(loadedFor===key||loadingFor===key)return;
 loadingFor=key;
 if(key==="local"){const d=readLocal();G=d.G;LOG=d.log;loadedFor=key;loadingFor=null;return}
 G=null;render();
 const r=await window.__cloud.getGym();
 if(loadingFor!==key)return;
 loadingFor=null;
 if(!r.ok){const d=readLocal();G=d.G;LOG=d.log;loadedFor="local";toast("Could not load your training from your account ("+r.error+"). Showing this browser's copy.");return}
 G={...blank(),...(r.plan||{})};LOG=r.log||[];loadedFor=key;
 // what was logged before signing in on this device moves into the account
 const d=ls.get(LSK);
 if(d&&((d.log&&d.log.length)||(d.G&&d.G.routines&&d.G.routines.length))){
  const loc=readLocal();
  if(!r.plan||!G.routines.length){G={...loc.G,updatedAt:Date.now()}}
  else{loc.G.routines.forEach(x=>{if(!routine(x.id))G.routines.push(x)});G.custom={...loc.G.custom,...G.custom}}
  const have=new Set(LOG.map(x=>x.id)),add=loc.log.filter(x=>!have.has(x.id));
  const res=await Promise.all([window.__cloud.saveGym(clean(G)),...add.map(x=>window.__cloud.putGymLog(clean(x)))]);
  if(res.every(x=>x.ok)){LOG=LOG.concat(add);ls.del(LSK);toast("Your training from this browser is now saved in your account.")}
  else toast("Could not move this browser's training into your account ("+(res.find(x=>!x.ok).error)+").");
 }
}
function savePlan(){
 G.updatedAt=Date.now();
 if(loadedFor!=="local"&&signed()){clearTimeout(saveT);saveT=setTimeout(async()=>{const r=await window.__cloud.saveGym(clean(G));if(!r.ok)toast("Could not save your plan ("+r.error+").")},500)}
 else persistLocal();
}
async function putLog(e){
 LOG=LOG.filter(x=>x.id!==e.id).concat([e]);
 if(loadedFor!=="local"&&signed()){const r=await window.__cloud.putGymLog(clean(e));if(!r.ok){toast("Could not save ("+r.error+").");return false}}
 else persistLocal();
 return true;
}
async function delLog(id){
 LOG=LOG.filter(x=>x.id!==id);
 if(loadedFor!=="local"&&signed()){const r=await window.__cloud.delGymLog(id);if(!r.ok)toast("Could not delete ("+r.error+").")}
 else persistLocal();
}
const saveDraft=()=>{if(draft)ls.set(DRK,draft);else ls.del(DRK)};

/* ---------- plan helpers ---------- */
const DEF_DAYS={1:[2],2:[0,3],3:[0,2,4],4:[0,1,3,4],5:[0,1,2,3,4],6:[0,1,2,3,4,5],7:[0,1,2,3,4,5,6]};
// days without a valid session get the routines in turn
function fillSched(){
 const ids=G.routines.map(r=>r.id);let k=0;
 G.days.slice().sort((a,b)=>a-b).forEach(d=>{const v=G.sched[d];if(v!=="padel"&&!ids.includes(v)){G.sched[d]=ids.length?ids[k%ids.length]:"padel";k++}else if(v!=="padel")k=ids.indexOf(v)+1});
 Object.keys(G.sched).forEach(d=>{if(!G.days.includes(+d))delete G.sched[d]});
}
function setDayCount(n){
 if(G.days.length===n)return;
 // a well spread week with the routines in turn; padel days and single days can be changed afterwards
 G.days=DEF_DAYS[n].slice();G.sched={};fillSched();
}
function useTpl(k){
 const t=TPL[k];
 t.routines.forEach(r=>G.routines.push({id:"r"+uid(),name:r.name,note:r.note,ex:r.ex.map(e=>({id:e[0],sets:e[1],reps:e[2],rest:e[3]}))}));
 if(!G.days.length&&t.days.length)G.days=t.days.slice();
 fillSched();savePlan();
}

/* ---------- views ---------- */
function render(){
 const box=$("gymBody");if(!box)return;
 const intro=$("gymIntro");
 if(intro)intro.innerHTML=signed()?"Plan your gym week, log every set and watch your numbers climb. Saved in your account.":'Plan your gym week, log every set and watch your numbers climb. Saved in this browser only. <button type="button" class="gx-signin" data-g="signin">Sign in</button> to keep it on every device.';
 if(!G){box.innerHTML='<div class="card gx-empty">Loading your training…</div>';return}
 if(tab==="workout"&&!draft)tab="plan";
 const tabs=[["plan","Plan"]].concat(draft?[["workout","Workout"]]:[],[["history","History"],["progress","Progress"],["library","Exercises"]]);
 box.innerHTML=`<div class="seg gx-tabs" role="tablist">${tabs.map(t=>`<button type="button" role="tab" aria-selected="${tab===t[0]}" class="${tab===t[0]?"on":""}${t[0]==="workout"?" gx-live":""}" data-g="tab" data-v="${t[0]}">${t[1]}</button>`).join("")}</div>`+
  (tab==="workout"?vWorkout():tab==="history"?vHistory():tab==="progress"?vProgress():tab==="library"?vLibrary():vPlan());
 hydrate();timers();
}
function vPlan(){
 let s="";
 if(draft&&tab!=="workout")s+=`<button type="button" class="primary gx-resume" data-g="tab" data-v="workout">Resume ${E(draft.name)} · <span class="gx-el"></span></button>`;
 if(!G.routines.length)return s+vStarter();
 return s+vWeek()+vSetup()+vRoutines();
}
function vStarter(){
 return `<div class="card gx-card"><h2>Set up your training</h2><p class="gx-lead">Start from a ready-made plan or build your own. You can change every exercise, set and training day afterwards.</p><div class="gx-tpls">`+
  Object.keys(TPL).map(k=>`<button type="button" class="gx-tpl" data-g="usetpl" data-k="${k}"><b>${E(TPL[k].name)}</b><small>${E(TPL[k].desc)}</small></button>`).join("")+
  `<button type="button" class="gx-tpl gx-own" data-g="new"><b>Build my own</b><small>Start with an empty routine and pick the exercises yourself.</small></button></div></div>`;
}
function dayInfo(ws){
 const m={};LOG.forEach(x=>{if(x.ts>=ws&&x.ts<ws+7*864e5){const i=wd(new Date(x.ts));m[i]=m[i]||{w:0,p:0};m[i][x.kind==="w"?"w":"p"]++}});return m;
}
function vWeek(){
 const ws=weekStart(new Date()),c=weekCounts(ws),gl=goals(),di=dayInfo(ws),today=wd(new Date()),st=streak();
 const part=(n,goal,lbl)=>`<span><b>${Math.min(n,goal)}</b> of ${goal} ${lbl}</span>`;
 const total=gl.g+gl.p,doneN=Math.min(c.g,gl.g)+Math.min(c.p,gl.p),pct=total?Math.round(100*doneN/total):0;
 let s=`<div class="card gx-card"><div class="gx-row"><h2>This week</h2><span class="grow"></span>${st?`<span class="gx-streak">${st} week${st>1?"s":""} in a row on plan</span>`:""}</div>`;
 if(total)s+=`<p class="gx-sum">${[gl.g?part(c.g,gl.g,"gym days"):"",gl.p?part(c.p,gl.p,"padel days"):""].filter(Boolean).join(" · ")}${met(c,gl)?' <span class="gx-ok">Week complete.</span>':""}</p><div class="gx-bar" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><i style="width:${pct}%"></i></div>`;
 else s+='<p class="gx-sum">Choose your training days below to set a weekly goal.</p>';
 s+='<div class="gx-days">'+WD.map((n,i)=>{
  const plan=G.days.includes(i)?G.sched[i]:null,r=plan&&plan!=="padel"?routine(plan):null,d=di[i]||{w:0,p:0},done=d.w||d.p;
  const lbl=plan==="padel"?"Padel":r?r.name:"Rest";
  return `<div class="gx-day${i===today?" today":""}${plan?" on":""}${plan==="padel"?" pd":""}${done?" done":""}"><b>${n}</b><span>${E(lbl)}</span><i aria-label="${done?"done":""}">${done?"✓":""}</i></div>`}).join("")+'</div>';
 // today
 const tp=G.days.includes(today)?G.sched[today]:null,tr=tp&&tp!=="padel"?routine(tp):null,td=di[today]||{w:0,p:0};
 if(tr&&!td.w)s+=`<div class="gx-today"><div class="grow"><small>Today</small><b>${E(tr.name)}</b><span class="note">${tr.ex.length} exercise${tr.ex.length===1?"":"s"}</span></div><button type="button" class="primary" data-g="start" data-id="${tr.id}">Start workout</button></div>`;
 else if(tp==="padel"&&!td.p)s+=`<div class="gx-today"><div class="grow"><small>Today</small><b>Padel</b><span class="note">Log it after you play.</span></div><button type="button" class="primary" data-g="padel">Log padel</button></div>`;
 else if(td.w||td.p)s+='<div class="gx-today"><div class="grow"><small>Today</small><b>Done. Nice work.</b></div></div>';
 else s+='<div class="gx-today"><div class="grow"><small>Today</small><b>Rest day</b><span class="note">Want to train anyway? Start any routine below.</span></div></div>';
 return s+"</div>";
}
function vSetup(){
 const n=G.days.length,opts=v=>G.routines.map(r=>`<option value="${r.id}"${v===r.id?" selected":""}>${E(r.name)}</option>`).join("")+`<option value="padel"${v==="padel"?" selected":""}>Padel</option>`;
 return `<div class="card gx-card"><h2>Your week</h2><p class="gx-q">How many days a week do you want to train?</p><div class="seg gx-count">${[1,2,3,4,5,6,7].map(k=>`<button type="button" class="${k===n?"on":""}" data-g="count" data-n="${k}" aria-pressed="${k===n}">${k}</button>`).join("")}</div>`+
  `<p class="gx-q">On which days?</p><div class="gx-wd">${WD.map((d,i)=>`<button type="button" class="${G.days.includes(i)?"on":""}" data-g="wday" data-d="${i}" aria-pressed="${G.days.includes(i)}">${d}</button>`).join("")}</div>`+
  (n?`<p class="gx-q">What do you do on each day?</p><div class="gx-assign">${G.days.slice().sort((a,b)=>a-b).map(d=>`<label><span>${WDL[d]}</span><select data-gs="${d}">${opts(G.sched[d])}</select></label>`).join("")}</div>`:"")+"</div>";
}
function vRoutines(){
 let s=`<div class="card gx-card"><div class="gx-row"><h2>Your routines</h2><span class="grow"></span><button type="button" class="secondary" data-g="tpls">Ready-made</button><button type="button" class="primary" data-g="new">New routine</button></div><div class="gx-rts">`;
 s+=G.routines.map(r=>{const l=lastOf(r.id),days=G.days.filter(d=>G.sched[d]===r.id).sort((a,b)=>a-b).map(d=>WD[d]);
  return `<div class="gx-rt"><div class="grow"><b>${E(r.name)}</b><small>${r.ex.length} exercise${r.ex.length===1?"":"s"}${days.length?" · "+days.join(", "):""} · ${l?"last done "+fmtD(l.ts):"not done yet"}</small><small class="gx-rt-ex">${E(r.ex.map(e=>exName(e.id,e.name)).join(", "))}</small></div><div class="gx-rt-btns"><button type="button" class="secondary" data-g="edit" data-id="${r.id}">Edit</button><button type="button" class="primary" data-g="start" data-id="${r.id}">Start</button></div></div>`}).join("");
 return s+`</div><div class="gx-row gx-more"><button type="button" class="secondary" data-g="free">Start an empty workout</button><button type="button" class="secondary" data-g="padel">Log a padel session</button></div></div>`;
}
function cols(type){if(type==="time")return [["sec","Sec","numeric"]];if(type==="reps")return [["reps","Reps","numeric"]];return [["kg",type==="bw"?"+kg":"kg","decimal"],["reps","Reps","numeric"]]}
function mkSets(n){return Array.from({length:Math.max(1,n|0)},()=>({kg:"",reps:"",sec:"",done:false}))}
function newDraft(r){return {routine:r?r.id:null,name:r?r.name:"Workout",note:r?r.note||"":"",start:Date.now(),
 exercises:r?r.ex.map(e=>({id:e.id,name:exName(e.id,e.name),target:e.sets+" × "+e.reps,rest:e.rest||90,sets:mkSets(e.sets)})):[],memo:""}}
function vWorkout(){
 let s=`<div class="gx-whead"><div class="grow"><b>${E(draft.name)}</b><small>Time <span class="gx-el"></span></small></div><button type="button" class="primary" data-g="finish">Finish</button></div>`;
 if(draft.note)s+=`<p class="gx-note">${E(draft.note)}</p>`;
 if(!draft.exercises.length)s+='<div class="card gx-empty">No exercises yet. Add the first one.</div>';
 draft.exercises.forEach((e,i)=>{
  const type=exType(e.id),pv=prevSets(e.id)||[],cl=cols(type);
  s+=`<div class="card gx-ex"><div class="gx-extop"><button type="button" class="gx-thumb" data-g="info" data-id="${e.id}" aria-label="How to do ${E(e.name)}">${fig(e.id,60)}</button><div class="grow"><button type="button" class="gx-exname" data-g="info" data-id="${e.id}">${E(exName(e.id,e.name))}</button><small>${E(e.target||"")}${e.rest?" · rest "+clock(e.rest):""}</small></div><button type="button" class="gx-x" data-g="rmex" data-i="${i}" aria-label="Remove exercise" title="Remove exercise">×</button></div>`;
  s+=`<table class="gx-sets"><thead><tr><th>Set</th><th>Last time</th>${cl.map(c=>`<th>${c[1]}</th>`).join("")}<th><span class="sr">Done</span></th></tr></thead><tbody>`;
  e.sets.forEach((st,j)=>{const p=pv[j];
   s+=`<tr class="${st.done?"done":""}" data-row="${i}-${j}"><td class="gx-n">${j+1}</td><td class="gx-prev">${p?E(setStr(type,p)):"–"}</td>`+
    cl.map(c=>{const ph=p&&p[c[0]]!=null?fmtKg(p[c[0]]):"";return `<td><input inputmode="${c[2]}" data-gf="${c[0]}" data-i="${i}" data-j="${j}" placeholder="${E(ph)}" value="${E(st[c[0]])}" aria-label="Set ${j+1} ${c[1]}"></td>`}).join("")+
    `<td><button type="button" class="gx-chk" data-g="chk" data-i="${i}" data-j="${j}" aria-pressed="${st.done}" aria-label="Set ${j+1} done">✓</button></td></tr>`});
  s+=`</tbody></table><div class="gx-exact"><button type="button" class="secondary" data-g="addset" data-i="${i}">Add set</button>${e.sets.length>1?`<button type="button" class="secondary" data-g="rmset" data-i="${i}">Remove set</button>`:""}</div></div>`;
 });
 s+=`<div class="card gx-card"><label>Notes<textarea data-gm="memo" rows="2" placeholder="How did it feel?">${E(draft.memo)}</textarea></label></div>`;
 return s+'<div class="gx-row gx-more"><button type="button" class="secondary" data-g="addex">Add exercise</button><span class="grow"></span><button type="button" class="danger" data-g="discard">Discard workout</button></div>';
}
function itemCard(o){
 if(o.kind==="w"){
  const sets=o.exercises.reduce((a,e)=>a+e.sets.length,0);
  let s=`<div class="card gx-item"><button type="button" class="gx-ihead" data-g="toggle" data-id="${o.id}" aria-expanded="${!!expanded[o.id]}"><span class="gx-iic">${icon("dumbbell")}</span><span class="grow"><b>${E(o.rname||"Workout")}</b><span class="gx-stats"><span>${fmtD(o.ts)}</span><span><b>${Math.round((o.dur||0)/60)}</b> min</span><span><b>${volume(o)}</b> kg</span><span><b>${sets}</b> sets</span>${o.prs&&o.prs.length?`<span class="gx-pr">${o.prs.length} record${o.prs.length>1?"s":""}</span>`:""}</span></span></button>`;
  if(expanded[o.id])s+='<div class="gx-detail">'+o.exercises.map(e=>{const t=exType(e.id);return `<div><b>${E(exName(e.id,e.name))}${o.prs&&o.prs.includes(e.id)?' <span class="gx-pr">Record</span>':""}</b><span>${e.sets.map(x=>E(setStr(t,x))).join(" · ")}</span></div>`}).join("")+(o.memo?`<p>${E(o.memo)}</p>`:"")+`<button type="button" class="danger" data-g="dellog" data-id="${o.id}">Delete</button></div>`;
  return s+"</div>";
 }
 let s=`<div class="card gx-item"><button type="button" class="gx-ihead" data-g="toggle" data-id="${o.id}" aria-expanded="${!!expanded[o.id]}"><span class="gx-iic pd">${icon("ball")}</span><span class="grow"><b>Padel · ${E(o.type||"Match")}</b><span class="gx-stats"><span>${fmtD(o.ts)}</span><span><b>${o.minutes||0}</b> min</span><span>Intensity <b>${o.intensity||"–"}</b>/5</span>${o.result==="Win"||o.result==="Loss"?`<span class="${o.result==="Win"?"gx-win":"gx-loss"}">${o.result}</span>`:""}</span></span></button>`;
 if(expanded[o.id])s+=`<div class="gx-detail">${o.note?`<p>${E(o.note)}</p>`:""}<button type="button" class="danger" data-g="dellog" data-id="${o.id}">Delete</button></div>`;
 return s+"</div>";
}
const icon=n=>`<svg class="ic" aria-hidden="true"><use href="#i-${n}"></use></svg>`;
function vHistory(){const it=sorted().reverse();return it.length?it.map(itemCard).join(""):'<div class="card gx-empty">Nothing logged yet. Finish a workout or log a padel session and it shows up here.</div>'}
function chart(pts,unit){
 const W=340,H=170,L=36,R=10,T=12,B=26;
 if(!pts.length)return '<p class="gx-empty">No data yet. Log this exercise in a workout.</p>';
 let mx=Math.max(...pts.map(p=>p.y)),mn=Math.min(...pts.map(p=>p.y));
 if(mx===mn){mx+=1;mn=Math.max(0,mn-1)}const rg=mx-mn;mx+=rg*.1;mn=Math.max(0,mn-rg*.1);
 const X=i=>pts.length===1?L+(W-L-R)/2:L+i*(W-L-R)/(pts.length-1),Y=v=>T+(H-T-B)*(1-(v-mn)/(mx-mn));
 let s=`<svg class="gx-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Progress chart">`;
 for(let g=0;g<=3;g++){const v=mn+(mx-mn)*g/3,y=Y(v);s+=`<line x1="${L}" x2="${W-R}" y1="${f1(y)}" y2="${f1(y)}" class="gl"/><text x="${L-5}" y="${f1(y+4)}" text-anchor="end">${Math.round(v*10)/10}</text>`}
 s+=`<polyline class="ln" points="${pts.map((p,i)=>f1(X(i))+","+f1(Y(p.y))).join(" ")}"/>`;
 pts.forEach((p,i)=>{s+=`<circle class="dt" cx="${f1(X(i))}" cy="${f1(Y(p.y))}" r="3.5"><title>${E(p.l)}: ${Math.round(p.y*10)/10} ${unit}</title></circle>`});
 const step=Math.max(1,Math.ceil(pts.length/5));pts.forEach((p,i)=>{if(i%step===0||i===pts.length-1)s+=`<text x="${f1(X(i))}" y="${H-8}" text-anchor="middle">${E(p.s)}</text>`});
 return s+"</svg>";
}
function weeksChart(){
 const W=340,H=150,L=10,B=24,T=10,n=8,ws=weekStart(new Date()),gl=goals(),data=[];let mx=Math.max(2.6,gl.g+.6);
 for(let i=n-1;i>=0;i--){const w=weekStart(new Date(ws-i*7*864e5+3*864e5)),c=weekCounts(w),d=new Date(w);data.push({c,l:d.getDate()+" "+MN[d.getMonth()]});mx=Math.max(mx,c.g,c.p)}
 const bw=(W-L*2)/n,Y=v=>T+(H-T-B)*(1-v/mx);
 let s=`<svg class="gx-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Sessions per week, last 8 weeks">`;
 if(gl.g)s+=`<line x1="${L}" x2="${W-L}" y1="${f1(Y(gl.g))}" y2="${f1(Y(gl.g))}" class="goal"/><text x="${W-L}" y="${f1(Y(gl.g)-4)}" text-anchor="end">goal ${gl.g}</text>`;
 data.forEach((d,i)=>{const x=L+i*bw+bw*.18,b=bw*.3;
  s+=`<rect x="${f1(x)}" y="${f1(Y(d.c.g))}" width="${f1(b)}" height="${f1(Y(0)-Y(d.c.g))}" rx="2" class="bg"><title>Gym: ${d.c.g}</title></rect>`;
  s+=`<rect x="${f1(x+b+2)}" y="${f1(Y(d.c.p))}" width="${f1(b)}" height="${f1(Y(0)-Y(d.c.p))}" rx="2" class="bp"><title>Padel: ${d.c.p}</title></rect>`;
  s+=`<text x="${f1(L+i*bw+bw/2)}" y="${H-8}" text-anchor="middle" style="font-size:9.5px">${d.l}</text>`});
 return s+'</svg><div class="gx-legend"><span><i class="bg"></i> Gym</span><span><i class="bp"></i> Padel</span></div>';
}
function vProgress(){
 const ws=workouts(),ps=padels(),vol=ws.reduce((a,w)=>a+volume(w),0),pm=ps.reduce((a,p)=>a+(p.minutes||0),0);
 const wins=ps.filter(p=>p.result==="Win").length,games=ps.filter(p=>p.result==="Win"||p.result==="Loss").length;
 const kpi=(v,l)=>`<div class="gx-kpi"><b>${v}</b><span>${l}</span></div>`;
 let s=`<div class="gx-kpis">${kpi(ws.length,"Gym workouts")}${kpi(streak(),"Weeks in a row on plan")}${kpi(vol>=1000?Math.round(vol/100)/10+"k":vol,"kg lifted in total")}${kpi(games?Math.round(100*wins/games)+"%":ps.length,games?`Padel wins (${wins} of ${games})`:"Padel sessions")}</div>`;
 s+=`<div class="card gx-card"><h2>Last 8 weeks</h2>${weeksChart()}${pm?`<p class="note">${Math.round(pm/6)/10} hours of padel logged.</p>`:""}</div>`;
 const ids=[];G.routines.forEach(r=>r.ex.forEach(e=>{if(!ids.includes(e.id))ids.push(e.id)}));ws.forEach(w=>w.exercises.forEach(e=>{if(!ids.includes(e.id))ids.push(e.id)}));
 if(!ids.length)return s;
 if(!progEx||!ids.includes(progEx))progEx=(ids.find(id=>ws.some(w=>w.exercises.some(e=>e.id===id))))||ids[0];
 const type=exType(progEx),ms=type==="weight"?[["top","Heaviest"],["e1rm","Estimated max"],["vol","Volume"]]:[["top","Best set"],["vol","Total"]];
 if(!ms.some(m=>m[0]===progMetric))progMetric="top";
 const unit=type==="time"?"s":type==="weight"?"kg":"reps";
 const pts=[],hist=[];ws.forEach(w=>w.exercises.forEach(e=>{if(e.id===progEx&&e.sets.length){const d=new Date(w.ts);pts.push({y:metric(type,e.sets,progMetric),s:d.getDate()+"/"+(d.getMonth()+1),l:fmtD(w.ts)});hist.push({ts:w.ts,sets:e.sets})}}));
 s+=`<div class="card gx-card"><h2>Per exercise</h2><div class="gx-row"><span class="gx-thumb sm">${fig(progEx,48)}</span><select class="grow" data-gsel="progex" aria-label="Exercise">${ids.map(id=>`<option value="${id}"${id===progEx?" selected":""}>${E(exName(id))}</option>`).join("")}</select></div>`;
 s+=`<div class="seg gx-metric">${ms.map(m=>`<button type="button" class="${progMetric===m[0]?"on":""}" data-g="metric" data-m="${m[0]}">${m[1]}</button>`).join("")}</div>${chart(pts,unit)}`;
 if(pts.length){const best=Math.max(...pts.map(p=>p.y));s+=`<p class="note">Best: <b>${Math.round(best*10)/10} ${unit}</b> · ${pts.length} session${pts.length>1?"s":""}</p>`}
 s+="</div>";
 if(hist.length)s+='<div class="card gx-card"><h2>Sets log</h2>'+hist.reverse().slice(0,8).map(h=>`<div class="gx-log"><b>${fmtD(h.ts)}</b><span>${h.sets.map(x=>E(setStr(type,x))).join(" · ")}</span></div>`).join("")+"</div>";
 return s;
}
function libIds(cat){const own=Object.keys(G.custom);return cat==="mine"?own:cat==="all"?Object.keys(EX).concat(own):Object.keys(EX).filter(id=>EX[id].cat===cat)}
function vLibrary(){
 const ids=libIds(libCat);
 return `<div class="card gx-card"><div class="gx-row"><p class="gx-lead grow">Tap an exercise for form tips and a video. Missing one? Add your own.</p><button type="button" class="primary" data-g="newex">Add your own exercise</button></div><div class="gx-chips">${CATS.map(c=>`<button type="button" class="${libCat===c[0]?"on":""}" data-g="cat" data-c="${c[0]}" aria-pressed="${libCat===c[0]}">${c[1]}</button>`).join("")}</div></div>`+
  (ids.length?`<div class="gx-lib">${ids.map(id=>{const x=exOf(id);return `<button type="button" class="gx-libc" data-g="info" data-id="${id}"><span class="gx-figbox">${fig(id,110)}</span><b>${E(x.name)}</b><small>${E(x.mus||(TYPES.find(t=>t[0]===x.type)||["",""])[1])}</small></button>`}).join("")}</div>`:'<div class="card gx-empty">You haven’t added your own exercises yet.</div>');
}

/* ---------- dialogs ---------- */
function dlg(html){const d=$("gymDlg");$("gymDlgBody").innerHTML=html;hydrate();if(!d.open)d.showModal()}
function closeDlg(){const d=$("gymDlg");if(d&&d.open)d.close()}
const videoUrl=n=>"https://www.youtube.com/results?search_query="+encodeURIComponent(n+" exercise proper form");
function infoDlg(id){
 const x=exOf(id);if(!x)return;
 const own=!EX[id];
 dlg(`<span class="gx-bigfig">${fig(id,200)}</span><h2>${E(x.name)}</h2><p class="note">${E(x.mus||"")}${x.mus?" · ":""}${E((TYPES.find(t=>t[0]===x.type)||["",""])[1])}</p>`+
  (x.cues?`<ol class="gx-cues">${x.cues.map(c=>`<li>${E(c)}</li>`).join("")}</ol>`:"")+
  `<div class="actions" style="margin:0"><a class="secondary gx-btnlink" href="${videoUrl(x.name)}" target="_blank" rel="noopener">Watch a video</a>${own?`<button type="button" class="danger" data-g="delex" data-id="${id}">Delete exercise</button>`:""}<button type="button" class="primary" data-g="close">Close</button></div>`);
}
function editDlg(){
 const r=edit;
 dlg(`<h2>${r.isNew?"New routine":"Edit routine"}</h2><label>Name<input data-ge="name" maxlength="40" value="${E(r.name)}" placeholder="e.g. Legs and core"></label><label>Note (optional)<input data-ge="note" maxlength="140" value="${E(r.note||"")}" placeholder="e.g. Warm-up: 5 min rowing"></label>`+
  `<div class="gx-elist">${r.ex.length?r.ex.map((e,i)=>`<div class="gx-erow"><span class="gx-thumb sm">${fig(e.id,40)}</span><div class="grow"><b>${E(exName(e.id,e.name))}</b><div class="gx-einp"><label>Sets<input inputmode="numeric" data-ge="sets" data-i="${i}" value="${E(e.sets)}"></label><label>Reps<input data-ge="reps" data-i="${i}" maxlength="16" value="${E(e.reps)}" placeholder="8"></label><label>Rest (s)<input inputmode="numeric" data-ge="rest" data-i="${i}" value="${E(e.rest)}"></label></div></div><div class="gx-emove"><button type="button" data-g="eup" data-i="${i}" aria-label="Move up"${i?"":" disabled"}>↑</button><button type="button" data-g="edown" data-i="${i}" aria-label="Move down"${i<r.ex.length-1?"":" disabled"}>↓</button><button type="button" data-g="edel" data-i="${i}" aria-label="Remove">×</button></div></div>`).join(""):'<p class="note">No exercises yet.</p>'}</div>`+
  `<button type="button" class="secondary" data-g="eadd">Add exercise</button><div class="actions" style="margin:0"><button type="button" class="primary" data-g="esave">Save routine</button><button type="button" class="secondary" data-g="close">Cancel</button>${r.isNew?"":`<button type="button" class="danger" data-g="erm">Delete routine</button>`}</div>`);
}
function pickList(){
 const q=pickQ.trim().toLowerCase(),ids=libIds("all").filter(id=>!q||exName(id).toLowerCase().includes(q)||(exOf(id).mus||"").toLowerCase().includes(q));
 return ids.length?ids.map(id=>`<button type="button" class="gx-pick" data-g="pick" data-id="${id}"><span class="gx-thumb sm">${fig(id,44)}</span><span class="grow"><b>${E(exName(id))}</b><small>${E(exOf(id).mus||"")}</small></span></button>`).join(""):'<p class="note">No exercise with that name. Add it as your own.</p>';
}
function pickDlg(){
 pickQ="";
 dlg(`<h2>Add exercise</h2><input type="search" data-gq="1" placeholder="Search exercises…" aria-label="Search exercises"><div id="gxPickList" class="gx-picks">${pickList()}</div><div class="actions" style="margin:0"><button type="button" class="primary" data-g="newex">Add your own exercise</button><button type="button" class="secondary" data-g="pickback">Back</button></div>`);
}
function newExDlg(){
 dlg(`<h2>Your own exercise</h2><label>Name<input id="gxExName" maxlength="40" placeholder="e.g. Leg press"></label><label>Muscles (optional)<input id="gxExMus" maxlength="60" placeholder="e.g. Quads, glutes"></label><label>How do you log it?<select id="gxExType">${TYPES.map(t=>`<option value="${t[0]}">${t[1]}</option>`).join("")}</select></label><div class="actions" style="margin:0"><button type="button" class="primary" data-g="saveex">Save exercise</button><button type="button" class="secondary" data-g="${pickFor?"pickagain":"close"}">Back</button></div>`);
 setTimeout(()=>{const i=$("gxExName");if(i)i.focus()},30);
}
function padelDlg(){
 const f=pf,chips=(k,opts)=>`<div class="gx-chips">${opts.map(o=>`<button type="button" class="${String(f[k])===String(o)?"on":""}" data-g="pf" data-k="${k}" data-val="${o}" aria-pressed="${String(f[k])===String(o)}">${o}</button>`).join("")}</div>`;
 dlg(`<h2>Log a padel session</h2><div class="gx-two"><label>Date<input type="date" data-gp="date" value="${f.date}"></label><label>Minutes<input inputmode="numeric" data-gp="minutes" value="${E(f.minutes)}"></label></div>`+
  `<div class="gx-field"><span>Type</span>${chips("type",["Match","Training","Social"])}</div><div class="gx-field"><span>Intensity (1 easy, 5 very hard)</span>${chips("intensity",[1,2,3,4,5])}</div><div class="gx-field"><span>Result</span>${chips("result",["Win","Loss","No result"])}</div>`+
  `<label>Notes<textarea data-gp="note" rows="3" placeholder="Partner, what worked, what to practise…">${E(f.note)}</textarea></label><div class="actions" style="margin:0"><button type="button" class="primary" data-g="savepadel">Save session</button><button type="button" class="secondary" data-g="close">Cancel</button></div>`);
}
function tplDlg(){
 dlg(`<h2>Ready-made routines</h2><p class="note">Adds the routines to your list. Your training days stay as they are.</p><div class="gx-tpls">${Object.keys(TPL).map(k=>`<button type="button" class="gx-tpl" data-g="usetpl" data-k="${k}"><b>${E(TPL[k].routines.map(r=>r.name).join(" + "))}</b><small>${E(TPL[k].desc)}</small></button>`).join("")}</div><div class="actions" style="margin:0"><button type="button" class="secondary" data-g="close">Close</button></div>`);
}
function finishDlg(){
 let sets=0,vol=0;draft.exercises.forEach(e=>{const t=exType(e.id);e.sets.forEach(s=>{if(s.done){sets++;if(t==="weight")vol+=(num(s.kg)||0)*(num(s.reps)||0)}})});
 if(!sets){dlg('<h2>No sets done yet</h2><p class="note">Tick ✓ on the sets you’ve done, then finish.</p><div class="actions" style="margin:0"><button type="button" class="primary" data-g="close">OK</button></div>');return}
 dlg(`<h2>Finish workout?</h2><div class="gx-kpis">${[[clock((Date.now()-draft.start)/1000),"Time"],[sets,"Sets done"],[Math.round(vol),"kg lifted"]].map(k=>`<div class="gx-kpi"><b>${k[0]}</b><span>${k[1]}</span></div>`).join("")}</div><p class="note">Sets without a ✓ are not saved.</p><div class="actions" style="margin:0"><button type="button" class="primary" data-g="dofinish">Save workout</button><button type="button" class="secondary" data-g="close">Keep going</button></div>`);
}
async function doFinish(){
 const w={id:"w"+uid(),kind:"w",routine:draft.routine,rname:draft.name,ts:draft.start,date:ymd(new Date(draft.start)),dur:Math.round((Date.now()-draft.start)/1000),memo:draft.memo||"",
  exercises:draft.exercises.map(e=>({id:e.id,name:exName(e.id,e.name),sets:e.sets.filter(s=>s.done).map(s=>({kg:num(s.kg),reps:num(s.reps),sec:num(s.sec)}))})).filter(e=>e.sets.length)};
 w.prs=computePRs(w);
 closeDlg();
 const ok=await putLog(w);if(!ok)return;
 draft=null;saveDraft();restEnd=0;expanded[w.id]=true;tab="history";render();window.scrollTo(0,0);
 toast(w.prs.length?`Workout saved. ${w.prs.length} new personal record${w.prs.length>1?"s":""}!`:"Workout saved.");
}
function startRoutine(r){
 const go=()=>{draft=newDraft(r);saveDraft();tab="workout";render();window.scrollTo(0,0)};
 if(draft&&!confirm(`You already have "${draft.name}" running. Discard it and start ${r?r.name:"an empty workout"}?`))return;
 go();
}

/* ---------- timers ---------- */
function timers(){
 if(draft){const t=clock((Date.now()-draft.start)/1000);document.querySelectorAll("#gymView .gx-el").forEach(el=>el.textContent=t)}
 const rb=$("gymRest");if(!rb)return;const left=Math.ceil((restEnd-Date.now())/1000);
 if(restEnd&&left>0&&tab==="workout"&&draft&&view==="gym"){rb.hidden=false;rb.querySelector(".rt").textContent=clock(left);rb.querySelector(".rp").style.width=Math.min(100,100*left/restTotal)+"%"}
 else{if(restEnd&&left<=0){restEnd=0;try{if(navigator.vibrate)navigator.vibrate([150,80,150])}catch(e){}if(view==="gym")toast("Rest over. Next set!")}rb.hidden=true}
}
function startRest(sec){if(!sec)return;restTotal=sec;restEnd=Date.now()+sec*1000;timers()}

/* ---------- events (only inside the training page and its dialog) ---------- */
document.addEventListener("click",ev=>{
 const b=ev.target.closest("[data-g]");if(!b||!b.closest("#gymView,#gymDlg"))return;
 const a=b.dataset.g,i=+b.dataset.i,j=+b.dataset.j,id=b.dataset.id;
 if(a==="tab"){tab=b.dataset.v;render();window.scrollTo(0,0)}
 else if(a==="signin")toLogin();
 else if(a==="close")closeDlg();
 else if(a==="usetpl"){useTpl(b.dataset.k);closeDlg();render();toast("Routines added. Set your days in “Your week”.")}
 else if(a==="tpls")tplDlg();
 else if(a==="count"){setDayCount(+b.dataset.n);savePlan();render()}
 else if(a==="wday"){const d=+b.dataset.d;G.days=G.days.includes(d)?G.days.filter(x=>x!==d):G.days.concat([d]).sort((x,y)=>x-y);fillSched();savePlan();render()}
 else if(a==="start"){const r=routine(id);if(r)startRoutine(r)}
 else if(a==="free")startRoutine(null);
 else if(a==="new"){edit={isNew:true,id:"r"+uid(),name:"",note:"",ex:[]};editDlg()}
 else if(a==="edit"){const r=routine(id);if(r){edit={...clean(r),isNew:false};editDlg()}}
 else if(a==="eup"&&i>0){const x=edit.ex;[x[i-1],x[i]]=[x[i],x[i-1]];editDlg()}
 else if(a==="edown"&&i<edit.ex.length-1){const x=edit.ex;[x[i+1],x[i]]=[x[i],x[i+1]];editDlg()}
 else if(a==="edel"){edit.ex.splice(i,1);editDlg()}
 else if(a==="eadd"){pickFor="edit";pickDlg()}
 else if(a==="esave"){
  const r=edit;r.name=r.name.trim();if(!r.name){toast("Give the routine a name.");return}if(!r.ex.length){toast("Add at least one exercise.");return}
  const out={id:r.id,name:r.name.slice(0,40),note:(r.note||"").trim().slice(0,140),ex:r.ex.map(e=>({id:e.id,sets:Math.min(20,Math.max(1,parseInt(e.sets,10)||3)),reps:String(e.reps||"").trim().slice(0,16)||"10",rest:Math.min(900,Math.max(0,parseInt(e.rest,10)||0))}))};
  const k=G.routines.findIndex(x=>x.id===r.id);if(k>=0)G.routines[k]=out;else G.routines.push(out);
  if(r.isNew&&G.routines.length===1&&!G.days.length)setDayCount(2);
  fillSched();savePlan();edit=null;closeDlg();render();toast("Routine saved.")}
 else if(a==="erm"){if(!confirm(`Delete the routine "${edit.name}"? Your logged workouts stay in your history.`))return;G.routines=G.routines.filter(x=>x.id!==edit.id);G.days.forEach(d=>{if(G.sched[d]===edit.id)delete G.sched[d]});fillSched();savePlan();edit=null;closeDlg();render()}
 else if(a==="pick"){
  if(pickFor==="edit"){edit.ex.push({id,sets:3,reps:exType(id)==="time"?"30 s":"10",rest:60});editDlg()}
  else if(pickFor==="draft"){draft.exercises.push({id,name:exName(id),target:"",rest:90,sets:mkSets(3)});saveDraft();closeDlg();render();setTimeout(()=>window.scrollTo(0,document.body.scrollHeight),50)}}
 else if(a==="pickback"){if(pickFor==="edit")editDlg();else closeDlg()}
 else if(a==="pickagain")pickDlg();
 else if(a==="newex")newExDlg();
 else if(a==="saveex"){
  const name=$("gxExName").value.trim().slice(0,40);if(!name){toast("Give the exercise a name.");return}
  const nid="c"+uid();G.custom[nid]={name,mus:$("gxExMus").value.trim().slice(0,60),type:$("gxExType").value};savePlan();
  if(pickFor==="edit"){edit.ex.push({id:nid,sets:3,reps:G.custom[nid].type==="time"?"30 s":"10",rest:60});editDlg()}
  else if(pickFor==="draft"){draft.exercises.push({id:nid,name,target:"",rest:90,sets:mkSets(3)});saveDraft();closeDlg();render()}
  else{closeDlg();libCat="mine";render()}
  toast("Exercise added.")}
 else if(a==="delex"){if(!confirm("Delete this exercise? It is also removed from your routines; your history keeps it."))return;
  const name=exName(id);G.routines.forEach(r=>r.ex=r.ex.filter(e=>e.id!==id));delete G.custom[id];
  LOG.forEach(w=>{if(w.kind==="w")w.exercises.forEach(e=>{if(e.id===id&&!e.name)e.name=name})});savePlan();closeDlg();render()}
 else if(a==="info")infoDlg(id);
 else if(a==="chk"){
  const e=draft.exercises[i],s=e.sets[j],type=exType(e.id),row=document.querySelector(`#gymView tr[data-row="${i}-${j}"]`);
  if(!s.done){let ok=true;cols(type).forEach(c=>{if(s[c[0]]===""||s[c[0]]==null){const inp=row.querySelector(`input[data-gf="${c[0]}"]`);if(inp&&inp.placeholder){s[c[0]]=inp.placeholder;inp.value=inp.placeholder}else if(c[0]!=="kg")ok=false}});
   if(!ok){toast(type==="time"?"Enter the seconds first.":"Enter your reps first.");return}
   s.done=true;row.classList.add("done");b.setAttribute("aria-pressed","true");startRest(e.rest||90)}
  else{s.done=false;row.classList.remove("done");b.setAttribute("aria-pressed","false")}
  saveDraft()}
 else if(a==="addset"){const e=draft.exercises[i],l=e.sets[e.sets.length-1];e.sets.push({kg:l?l.kg:"",reps:l?l.reps:"",sec:l?l.sec:"",done:false});saveDraft();render()}
 else if(a==="rmset"){draft.exercises[i].sets.pop();saveDraft();render()}
 else if(a==="rmex"){if(confirm(`Remove ${exName(draft.exercises[i].id,draft.exercises[i].name)} from this workout?`)){draft.exercises.splice(i,1);saveDraft();render()}}
 else if(a==="addex"){pickFor="draft";pickDlg()}
 else if(a==="discard"){if(confirm("Discard this workout? All sets from this session will be lost.")){draft=null;saveDraft();restEnd=0;tab="plan";render()}}
 else if(a==="finish")finishDlg();
 else if(a==="dofinish")doFinish();
 else if(a==="padel"){pf={date:ymd(new Date()),minutes:90,type:"Match",intensity:3,result:"No result",note:""};padelDlg()}
 else if(a==="pf"){const k=b.dataset.k,v=b.dataset.val;pf[k]=k==="intensity"?+v:v;const sh=$("gymDlgBody"),top=sh.scrollTop;padelDlg();sh.scrollTop=top}
 else if(a==="savepadel"){const f=pf;if(!f.date){toast("Pick a date.");return}const d=fromYmd(f.date),now=new Date();if(f.date===ymd(now))d.setHours(now.getHours(),now.getMinutes());
  putLog({id:"p"+uid(),kind:"p",ts:d.getTime(),date:f.date,minutes:num(f.minutes)||0,type:f.type,intensity:f.intensity,result:f.result,note:String(f.note||"").slice(0,500)}).then(ok=>{if(ok){closeDlg();render();toast("Padel session saved.")}})}
 else if(a==="toggle"){expanded[id]=!expanded[id];render()}
 else if(a==="dellog"){if(confirm("Delete this session? It is removed from your history and progress.")){delLog(id).then(render)}}
 else if(a==="metric"){progMetric=b.dataset.m;render()}
 else if(a==="cat"){libCat=b.dataset.c;render()}
 else if(a==="rest-"){restEnd=Math.max(Date.now()+1000,restEnd-15000);timers()}
 else if(a==="rest+"){restEnd+=15000;restTotal+=15;timers()}
 else if(a==="restskip"){restEnd=0;timers()}
});
document.addEventListener("input",ev=>{
 const t=ev.target;if(!t.closest||!t.closest("#gymView,#gymDlg"))return;
 if(t.dataset.gf!=null&&draft){const e=draft.exercises[+t.dataset.i];if(e){e.sets[+t.dataset.j][t.dataset.gf]=t.value;saveDraft()}}
 else if(t.dataset.gm!=null&&draft){draft.memo=t.value;saveDraft()}
 else if(t.dataset.ge!=null&&edit){const k=t.dataset.ge;if(t.dataset.i!=null)edit.ex[+t.dataset.i][k]=t.value;else edit[k]=t.value}
 else if(t.dataset.gp!=null&&pf)pf[t.dataset.gp]=t.value;
 else if(t.dataset.gq!=null){pickQ=t.value;$("gxPickList").innerHTML=pickList();hydrate()}
});
document.addEventListener("change",ev=>{
 const t=ev.target;if(!t.closest||!t.closest("#gymView"))return;
 if(t.dataset.gs!=null){G.sched[+t.dataset.gs]=t.value;savePlan();render()}
 else if(t.dataset.gsel==="progex"){progEx=t.value;progMetric="top";render()}
});

/* ---------- the page ---------- */
window.openGym=function(){if(window.CLOUD_ON&&location.hash!=="#gym")location.hash="gym";else showGym()};
window.showGym=async function(){
 showView("gym");window.scrollTo(0,0);
 if(!G||loadedFor!==(signed()?authUser.uid:"local"))await load();
 render();
};
// signing in or out while the page is open: show that person's training
window.gymAuthChanged=async function(){if(view!=="gym")return;await load();render()};
setInterval(()=>{if(view==="gym")timers()},500);
requestAnimationFrame(tick);
})();

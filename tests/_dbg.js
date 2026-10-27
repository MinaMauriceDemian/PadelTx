process.chdir("/home/claude/site");
const src=require("fs").readFileSync(__dirname+"/run.js","utf8").split("\nlet failed")[0];
eval(src+`;const {E,doc}=loadApp({phone:true});E("rebuild();refresh()");
console.log(E("[...new Set(allMatches().map(m=>m.slot))].join(',')"));
console.log([...doc.querySelectorAll("#mcar > .mslot")].map(x=>x.dataset.slot).join(','));
console.log(JSON.stringify(doc.getElementById("mcarPos").textContent));`)

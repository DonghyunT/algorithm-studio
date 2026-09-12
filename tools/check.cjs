const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
let scripts=0;
function walk(folder){for(const entry of fs.readdirSync(folder,{withFileTypes:true})){const file=path.join(folder,entry.name);if(entry.isDirectory())walk(file);else if(/\.(js|cjs)$/.test(file)&&!file.endsWith(path.join('data','config.js'))){new vm.Script(fs.readFileSync(file,'utf8'),{filename:file});scripts++;}}}
for(const folder of ['js','api','server','tests','tools'])walk(path.join(root,folder));
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
for(const match of html.matchAll(/(?:src|href)="((?:js|css)\/[^"?#]+)"/g))assert.ok(fs.existsSync(path.join(root,match[1])),'Missing '+match[1]);
assert.ok(!html.includes('src="js/data/config.js"'),'Local secret config must not load');
console.log('Syntax OK: '+scripts+' scripts; local HTML assets OK.');

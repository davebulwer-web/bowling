import json
P=json.load(open('portraits.json'))
js='const PORTRAIT_DATA = '+json.dumps(P)+';\n'
for f in ['phys.js','logic.js','game.js','game2.js','game3.js','game4.js']:
    js+='\n'+open(f).read()
s=open('shell.html').read().replace('/*SCRIPT*/',js)
import os
os.makedirs('site',exist_ok=True)
open('site/index.html','w').write(s)
print(len(s))

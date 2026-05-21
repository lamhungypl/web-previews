import { Prettifier } from '@/components/Prettifier'

const SAMPLE = `function add(a,b){return a+b};const greet=(name)=>{console.log("hi, "+name+"!")};type User={id:number,name:string};const users:User[]=[{id:1,name:"ada"},{id:2,name:"linus"}];`

export function JsPrettifyRoute() {
  return (
    <Prettifier
      downloadName="formatted.ts"
      initial={SAMPLE}
      language="ts"
      placeholder="Paste JavaScript or TypeScript here…"
      title="JS / TS Prettify"
    />
  )
}

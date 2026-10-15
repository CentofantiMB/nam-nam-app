import { DailyLog, Macros, MealEntry, MealType } from './types';

const MEALS:MealType[]=['Desayuno','Colación 1','Almuerzo','Colación 2','Merienda','Cena'];

type Cell = { value:string|number; style?:number; type?:'s'|'n' };
type SheetModel = { rows:Cell[][]; merges:string[]; widths:number[]; autoFilter?:string };

function esc(value:string){
  return value.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
}

function add(a:Macros,b:Macros):Macros{
  return {kcal:a.kcal+b.kcal,fat:a.fat+b.fat,carbs:a.carbs+b.carbs,protein:a.protein+b.protein,fiber:a.fiber+b.fiber};
}
function empty():Macros{return {kcal:0,fat:0,carbs:0,protein:0,fiber:0};}
function totals(entries:MealEntry[]){return entries.reduce((a,e)=>add(a,e.macros),empty());}
function displayDate(date:string){
  return new Intl.DateTimeFormat('es-AR',{weekday:'long',day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(`${date}T12:00:00`));
}
function excelDateSerial(date:string){
  const [year,month,day]=date.split('-').map(Number);
  return Math.floor((Date.UTC(year,month-1,day)-Date.UTC(1899,11,30))/86400000);
}
function round(v:number,d=2){const p=10**d;return Math.round((v+Number.EPSILON)*p)/p;}
function num(v:number,style=5):Cell{return {value:round(v,2),type:'n',style};}
function dateCell(v:string):Cell{return {value:excelDateSerial(v),type:'n',style:9};}
function txt(v:string,style=0):Cell{return {value:v,type:'s',style};}

function detailSheet(logs:DailyLog[]):SheetModel{
  const rows:Cell[][]=[];
  rows.push(['Fecha','Comida','Alimento','Cantidad','Unidad','Kcal','Proteína (g)','Carbos (g)','Grasas (g)','Fibra (g)'].map(v=>txt(v,1)));

  for(const log of logs){
    for(const meal of MEALS){
      const entries=log.entries.filter(e=>e.mealType===meal);
      for(const e of entries){
        rows.push([
          dateCell(log.date),
          txt(meal),
          txt(e.itemName),
          num(e.amount),
          txt(e.unit),
          num(e.macros.kcal),
          num(e.macros.protein),
          num(e.macros.carbs),
          num(e.macros.fat),
          num(e.macros.fiber)
        ]);
      }
    }
  }

  return {
    rows,
    merges:[],
    widths:[14,16,34,12,10,13,15,15,15,15],
    autoFilter:`A1:J${rows.length}`
  };
}

function summarySheet(logs:DailyLog[]):SheetModel{
  const rows:Cell[][]=[];
  rows.push(['Fecha','Registros','Kcal','Proteína (g)','Carbos (g)','Grasas (g)','Fibra (g)','Obj. kcal','Obj. proteína','Dif. kcal','Dif. proteína'].map(v=>txt(v,1)));
  for(const log of logs){
    const t=totals(log.entries);
    rows.push([
      txt(log.date),num(log.entries.length,8),num(t.kcal),num(t.protein),num(t.carbs),num(t.fat),num(t.fiber),num(log.goals.kcal),num(log.goals.protein),num(t.kcal-log.goals.kcal),num(t.protein-log.goals.protein)
    ]);
  }
  return {rows,merges:[],widths:[14,11,13,15,15,15,15,13,16,13,16],autoFilter:`A1:K${rows.length}`};
}

function colName(index:number){let n=index+1,s='';while(n){n--;s=String.fromCharCode(65+(n%26))+s;n=Math.floor(n/26);}return s;}
function cellXml(cell:Cell,row:number,col:number){
  const ref=`${colName(col)}${row}`; const style=cell.style?` s="${cell.style}"`:'';
  if(cell.type==='n'||typeof cell.value==='number') return `<c r="${ref}"${style}><v>${Number(cell.value)}</v></c>`;
  return `<c r="${ref}" t="inlineStr"${style}><is><t xml:space="preserve">${esc(String(cell.value??''))}</t></is></c>`;
}
function sheetXml(model:SheetModel){
  const rows=model.rows.map((row,i)=>`<row r="${i+1}">${row.map((c,j)=>cellXml(c,i+1,j)).join('')}</row>`).join('');
  const cols=model.widths.map((w,i)=>`<col min="${i+1}" max="${i+1}" width="${w}" customWidth="1"/>`).join('');
  const merges=model.merges.length?`<mergeCells count="${model.merges.length}">${model.merges.map(m=>`<mergeCell ref="${m}"/>`).join('')}</mergeCells>`:'';
  const autoFilter=model.autoFilter?`<autoFilter ref="${model.autoFilter}"/>`:'';
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${cols}</cols><sheetData>${rows}</sheetData>${autoFilter}${merges}</worksheet>`;
}

const stylesXml=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="2"><numFmt numFmtId="164" formatCode="0.00"/><numFmt numFmtId="165" formatCode="dd/mm/yyyy"/></numFmts>
<fonts count="3"><font><sz val="11"/><name val="Calibri"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>
<fills count="6"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF282C38"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FF6C63FF"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE9E7FF"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE8F5E9"/><bgColor indexed="64"/></patternFill></fill></fills>
<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left/><right/><top/><bottom style="thin"><color rgb="FFD9DCE5"/></bottom><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="10">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFill="1" applyFont="1"/>
<xf numFmtId="0" fontId="1" fillId="3" borderId="0" xfId="0" applyFill="1" applyFont="1"/>
<xf numFmtId="0" fontId="2" fillId="4" borderId="0" xfId="0" applyFill="1" applyFont="1"/>
<xf numFmtId="164" fontId="2" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyBorder="1"/>
<xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/>
<xf numFmtId="164" fontId="2" fillId="3" borderId="0" xfId="0" applyNumberFormat="1" applyFill="1" applyFont="1"/>
<xf numFmtId="164" fontId="2" fillId="5" borderId="0" xfId="0" applyNumberFormat="1" applyFill="1" applyFont="1"/>
<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"/>
<xf numFmtId="165" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/>
</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

function workbookParts(detail:SheetModel,summary:SheetModel){
  return [
    ['[Content_Types].xml',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`],
    ['_rels/.rels',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`],
    ['xl/workbook.xml',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Detalle diario" sheetId="1" r:id="rId1"/><sheet name="Resumen diario" sheetId="2" r:id="rId2"/></sheets></workbook>`],
    ['xl/_rels/workbook.xml.rels',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`],
    ['xl/styles.xml',stylesXml],
    ['xl/worksheets/sheet1.xml',sheetXml(detail)],
    ['xl/worksheets/sheet2.xml',sheetXml(summary)],
  ] as [string,string][];
}

const crcTable=(()=>{const table=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=(c&1)?0xEDB88320^(c>>>1):c>>>1;table[n]=c>>>0;}return table;})();
function crc32(bytes:Uint8Array){let c=0xFFFFFFFF;for(const b of bytes)c=crcTable[(c^b)&0xFF]^(c>>>8);return (c^0xFFFFFFFF)>>>0;}
function u16(n:number){return new Uint8Array([n&255,(n>>>8)&255]);}
function u32(n:number){return new Uint8Array([n&255,(n>>>8)&255,(n>>>16)&255,(n>>>24)&255]);}
function concat(parts:Uint8Array[]){const len=parts.reduce((a,p)=>a+p.length,0),out=new Uint8Array(len);let o=0;for(const p of parts){out.set(p,o);o+=p.length;}return out;}
function dosDateTime(d=new Date()){const year=Math.max(1980,d.getFullYear());const time=(d.getHours()<<11)|(d.getMinutes()<<5)|Math.floor(d.getSeconds()/2);const date=((year-1980)<<9)|((d.getMonth()+1)<<5)|d.getDate();return {time,date};}
function zip(files:[string,string][]){
  const enc=new TextEncoder(); const locals:Uint8Array[]=[]; const centrals:Uint8Array[]=[]; let offset=0; const dt=dosDateTime();
  for(const [name,text] of files){
    const n=enc.encode(name),data=enc.encode(text),crc=crc32(data);
    const local=concat([u32(0x04034b50),u16(20),u16(0x0800),u16(0),u16(dt.time),u16(dt.date),u32(crc),u32(data.length),u32(data.length),u16(n.length),u16(0),n,data]);
    locals.push(local);
    const central=concat([u32(0x02014b50),u16(20),u16(20),u16(0x0800),u16(0),u16(dt.time),u16(dt.date),u32(crc),u32(data.length),u32(data.length),u16(n.length),u16(0),u16(0),u16(0),u16(0),u32(0),u32(offset),n]);
    centrals.push(central); offset+=local.length;
  }
  const centralData=concat(centrals); const localData=concat(locals);
  const end=concat([u32(0x06054b50),u16(0),u16(0),u16(files.length),u16(files.length),u32(centralData.length),u32(localData.length),u16(0)]);
  return concat([localData,centralData,end]);
}

export function buildNutritionWorkbookBytes(allLogs:Record<string,DailyLog>,from:string,to:string){
  const logs=Object.values(allLogs).filter(l=>l.entries.length>0&&l.date>=from&&l.date<=to).sort((a,b)=>a.date.localeCompare(b.date));
  if(!logs.length) throw new Error('No hay consumos registrados en ese rango.');
  return {bytes:zip(workbookParts(detailSheet(logs),summarySheet(logs))),days:logs.length,entries:logs.reduce((s,l)=>s+l.entries.length,0)};
}

export function downloadNutritionWorkbook(allLogs:Record<string,DailyLog>,from:string,to:string){
  const built=buildNutritionWorkbookBytes(allLogs,from,to);
  const blob=new Blob([built.bytes],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
  const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=`nam-nam_${from}_a_${to}.xlsx`; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url),1000);
  return {days:built.days,entries:built.entries};
}

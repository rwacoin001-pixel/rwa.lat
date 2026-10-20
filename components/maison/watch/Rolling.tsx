'use client'

import React from 'react';

/** Permanent digit drums: changing a value moves the strip, never remounts the display. */
export function Drum({char}: {char:string}) {
  const digit = /^\d$/.test(char);
  const symbols = digit ? '0123456789' : char === '+' || char === '−' ? '+−' : char;
  const index = symbols.indexOf(char);
  return <span className={`drum ${digit ? 'drum-digit' : 'drum-symbol'}`} aria-hidden="true">
    <span className="drum-strip" style={{transform:`translateY(${-index}em)`}}>
      {symbols.split('').map((s,i) => <span key={i}>{s}</span>)}
    </span>
  </span>;
}

export function RollingNumber({value, decimals=2, signed=false}: {value:number|null;decimals?:number;signed?:boolean}) {
  const text = Math.abs(value ?? 0).toFixed(decimals);
  const [whole, fraction] = text.split('.');
  // Fixed slots prevent the decimal point moving when 9.99 becomes 10.00.
  const padded = whole.padStart(signed ? 3 : 2, '0');
  const firstVisible = Math.max(0, padded.length-whole.length);
  return <span className="rolling-number" data-empty={value===null} aria-label={value===null?'暂无数据':`${signed&&value>=0?'+':''}${value?.toFixed(decimals)}`}>
    <span className="number-cover"><span className="number-lift">
      <span className="number-digits">
        {signed && <Drum char={(value??0)<0?'−':'+'}/>}
        {padded.split('').map((char,i) => <span className="whole-slot" data-leading={i<firstVisible} key={i}><Drum char={char}/></span>)}
        <Drum char="."/>{fraction.split('').map((char,i) => <Drum key={'f'+i} char={char}/>)}
      </span>
      <span className="number-empty" aria-hidden="true">—</span>
    </span></span>
  </span>;
}

export function RollingDate({date}:{date:string}) {
  return <span className="rolling-date" aria-label={date}>
    {date.replaceAll('-','.').split('').map((char,i) => <Drum key={i} char={char}/>)}
  </span>;
}

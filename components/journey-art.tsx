export function JourneyCat({ black, face = false }: { black: boolean; face?: boolean }) {
  const fur = black ? "#38443b" : "#bc8d5f";
  const light = black ? "#536052" : "#e9c89e";
  return <svg viewBox={face ? "73 7 68 60" : "0 0 145 96"} aria-hidden="true" className="journey-cat-art">
    <g stroke="#49473a" strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round">
      {!face && <>
        <path d="M43 60C20 58 9 50 18 34c4-7 12-7 14-1-5 6-4 13 14 12" fill="none" stroke={fur} strokeWidth="12"/>
        <path d="M42 52Q53 34 85 45l32 8q13 14-2 24l-3 12h-10l-4-14-35 1-5 13H47l2-15q-12-6-7-22Z" fill={fur}/>
        <path d="m66 72 5 13h8l1-12m25 8 17 1 3-12" fill={light}/>
        {!black && <path d="m56 46 6 9m9-11 5 10m9-8 4 8M25 46l5-4" fill="none" stroke="#795a43"/>}
      </>}
      <path d="m83 38 1-23q1-4 5-2l13 12 14 0 13-13q4-3 5 3l1 23q8 23-23 26-30 0-33-16Z" fill={fur}/>
      <path d="m89 19 2 13 8-5Zm40 0-8 8 8 4Z" fill="#cf8584" stroke="none"/>
      {!black && <path d="m104 27 4 8m7-8-2 8" stroke="#8b6347"/>}
      <ellipse cx="99" cy="43" rx="3" ry="4" fill="#f2d481" stroke="none"/><ellipse cx="121" cy="43" rx="3" ry="4" fill="#f2d481" stroke="none"/>
      <path d="m107 48 7 0-3.5 3Z" fill="#d79892" stroke="none"/><path d="M110 51q-2 5-5 2m5-2q2 5 5 2" fill="none" stroke={light}/>
      <path d="m86 48-10-2m11 6-11 2m54-6 10-2m-11 6 10 2" stroke={light}/>
    </g>
  </svg>;
}

export function Landmark({ index }: { index: number }) {
  return <svg viewBox="0 0 125 85" aria-hidden="true" className="journey-landmark">
    <g stroke="#52654b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {index===0 && <><path d="M19 67V23h59v44m-62 0h65" fill="#eac67e"/><path d="M28 48V32l13 12 12-12v16" fill="none" stroke="#43586b" strokeWidth="5"/><path d="M49 67V54h13v13" fill="#a8a078"/><path d="m98 54 1-14-10 4 4-9-8-6 11 2 4-13 5 13 10-4-5 8 7 7-13-2-4 14Z" fill="#cb8266"/></>}
    {index===1 && <><path d="m31 12 2 10-9 35-5 11h30l-9-12-7-34m-9 26 16-13m-18 22 21-12M23 34l16 16" fill="none" stroke="#a75b63" strokeWidth="3"/><path d="M59 65V43h37v22m-43-22 25-18 24 18Z" fill="#e6b07d"/><path d="M70 54v11m14-11v11M56 71q12-6 23 0t24 0" fill="none"/></>}
    {index===2 && <><path d="m11 52 40-36 14 8 18-3 30 31" fill="#b9c1a0"/><path d="M35 68V45m54 23V45M26 38q36 7 72 0M31 45h62M32 53h60" fill="none" stroke="#a55c67" strokeWidth="5"/></>}
    {index===3 && <><path d="m7 68 16-51 16 51M14 50h18m-15-9 13 9m-15 6h17" fill="none" stroke="#92654f" strokeWidth="3"/><path d="m51 63 4-27 5 11 7-24 7 24 5-11 4 27Z" fill="#e7bf80"/><path d="m78 39 18-25 20 25-13-4-7 2-6-2Z" fill="#c2c8a9"/><path d="M91 70q4-15 22-15 7 4 4 11-9-3-13 5Z" fill="#e7aa64"/></>}
    {index===4 && <><path d="M7 65h112M28 62V23m64 40V23M24 26h8m56 0h8M10 51q9-2 18-24 32 51 64 0 9 20 24 25M30 40v22m17-15v15m15-12v12m16-19v19" fill="none" stroke="#ad5f64" strokeWidth="3"/><path d="M15 72q11-4 22 0t22 0 22 0 22 0" fill="none" stroke="#789a87"/></>}
    </g>
  </svg>;
}

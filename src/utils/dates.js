export const fmtDate = (d) => {
  if(!d) return "—";
  const dt = new Date(d);
  return dt.toLocaleDateString("ru-RU",{day:"2-digit",month:"2-digit",year:"numeric"})+" "+dt.toLocaleTimeString("ru-RU",{hour:"2-digit",minute:"2-digit"});
};
export const fmtShort = (d) => {
  if(!d) return "—";
  return new Date(d).toLocaleDateString("ru-RU",{day:"2-digit",month:"2-digit",year:"numeric"});
};
export const fmtTime = (d) => {
  if(!d) return "—";
  return new Date(d).toLocaleTimeString("ru-RU",{hour:"2-digit",minute:"2-digit"});
};
export const daysBetween = (a,b) => Math.round((new Date(b)-new Date(a))/(1000*60*60*24));
export const relTime = (d) => {
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff/60000);
  if(m<1) return "только что";
  if(m<60) return `${m} мин назад`;
  const h = Math.floor(m/60);
  if(h<24) return `${h}ч назад`;
  return fmtShort(d);
};

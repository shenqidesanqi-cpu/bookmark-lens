/** Literal matching: user input never becomes a regular expression or HTML. */
export default function Highlight({text,query}:{text:string;query:string}) {
  if (!query) return <>{text}</>;
  const result = []; let offset = 0;
  const lower = text.toLowerCase(), needle = query.toLowerCase();
  let index = lower.indexOf(needle);
  while (index !== -1) {
    result.push(text.slice(offset,index), <mark key={index}>{text.slice(index,index+query.length)}</mark>);
    offset=index+query.length; index=lower.indexOf(needle,offset);
  }
  result.push(text.slice(offset));
  return <>{result}</>;
}

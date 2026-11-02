export type Node = chrome.bookmarks.BookmarkTreeNode;
export function flatten(nodes: Node[]): Node[] { return nodes.flatMap(n => n.url ? [n] : flatten(n.children ?? [])); }
export function indexFolders(nodes: Node[]) { const result = new Map<string, Node>(); const walk = (items: Node[]) => items.forEach(n => { if (!n.url) { result.set(n.id,n); walk(n.children ?? []); } }); walk(nodes); return result; }
export function matchesBookmark(node: Node, query: string) { return `${node.title} ${node.url ?? ''}`.toLowerCase().includes(query.toLowerCase()); }

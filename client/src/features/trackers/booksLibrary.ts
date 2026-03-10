export interface BookResult {
  title: string;
  author: string;
  totalPages: number | null;
}

export async function searchBooks(query: string): Promise<BookResult[]> {
  if (!query.trim()) return [];
  try {
    const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&fields=title,author_name,number_of_pages_median&limit=6`;
    const resp = await fetch(url);
    if (!resp.ok) return [];
    const json = await resp.json();
    return (json.docs ?? [])
      .filter((d: any) => d.title)
      .map((d: any) => ({
        title: d.title,
        author: Array.isArray(d.author_name) ? d.author_name[0] : (d.author_name ?? 'Unknown'),
        totalPages: d.number_of_pages_median ?? null,
      }))
      .slice(0, 6);
  } catch {
    return [];
  }
}

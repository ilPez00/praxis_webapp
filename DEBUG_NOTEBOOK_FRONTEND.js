// Add this to NotebookPage.tsx fetchEntries function for debugging

console.log('[NotebookPage] Fetching entries with filters:', {
  userId: user.id,
  filterType,
  filterDomain,
  filterTag,
  searchQuery,
});

const res = await fetch(`${API_URL}/notebook/entries?${params.toString()}`, { headers });
const data = await res.json();
console.log('[NotebookPage] Received entries:', data?.length || 0, 'entries:', data);

// Also check what filterDomain is initialized as
// Look for this line and check the initial value:
const [filterDomain, setFilterDomain] = useState<string>('all');

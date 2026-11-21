// Enabled only by Vite in development; the desktop app uses its preload bridge.
if (import.meta.env.DEV && !window.ledger) {
  const request = async (url, options) => {
    const response = await fetch(url, options);
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Ошибка локального просмотра.');
    return result;
  };
  window.ledger = {
    read: () => request('/__preview/state'),
    command: command => request('/__preview/command', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(command)}),
    exportXlsx: async shiftId => {
      const response = await fetch(`/__preview/export/${encodeURIComponent(shiftId)}`);
      if (!response.ok) return response.json();
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = response.headers.get('Content-Disposition')?.match(/filename="([^"]+)"/)?.[1] || 'report.xlsx';
      document.body.appendChild(anchor); anchor.click(); anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url),1000);
      return {ok:true};
    }
  };
}

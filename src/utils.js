// ========================================
// Shared Utilities
// ========================================

/**
 * Plays a short success beep sound using the Web Audio API.
 */
export function playScanSound() {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);

        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // A5 note
        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);

        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.1);
    } catch (e) {
        console.warn('Audio feedback failed:', e);
    }
}

export function exportToCSV(headers, rows, filename) {
    let csvContent = "data:text/csv;charset=utf-8,\uFEFF";
    csvContent += headers.join(",") + "\n";

    rows.forEach(row => {
        let rowString = row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(",");
        csvContent += rowString + "\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

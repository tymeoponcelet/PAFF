(function () {
    const TARGET = new Date('2026-03-22T23:59:59');

    function pad(n) {
        return String(n).padStart(2, '0');
    }

    function updateCountdown() {
        const now = new Date();
        const diff = TARGET - now;

        const elDays    = document.getElementById('countdown-days');
        const elHours   = document.getElementById('countdown-hours');
        const elMinutes = document.getElementById('countdown-minutes');
        const elSeconds = document.getElementById('countdown-seconds');

        if (!elDays) return;

        if (diff <= 0) {
            elDays.textContent = elHours.textContent = elMinutes.textContent = elSeconds.textContent = '00';
            clearInterval(countdownInterval);
            document.querySelector('.countdown__display')?.classList.add('countdown__display--ended');
            return;
        }

        const days    = Math.floor(diff / 86400000);
        const hours   = Math.floor((diff % 86400000) / 3600000);
        const minutes = Math.floor((diff % 3600000) / 60000);
        const seconds = Math.floor((diff % 60000) / 1000);

        elDays.textContent    = pad(days);
        elHours.textContent   = pad(hours);
        elMinutes.textContent = pad(minutes);
        elSeconds.textContent = pad(seconds);
    }

    const countdownInterval = setInterval(updateCountdown, 1000);
    updateCountdown();
})();
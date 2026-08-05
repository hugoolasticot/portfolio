(function () {
    var layout = document.querySelector('.layout');
    var lastTrigger = null;

    function currentPopup() {
        var hash = location.hash.slice(1);
        if (!hash) return null;
        var el = document.getElementById(hash);
        return (el && el.classList.contains('popup-overlay')) ? el : null;
    }

    function openPopup(popup) {
        if (layout) layout.setAttribute('inert', '');
        document.body.classList.add('popup-open');

        popup.setAttribute('role', 'dialog');
        popup.setAttribute('aria-modal', 'true');

        var h1 = popup.querySelector('.popup-h1');
        if (h1) {
            if (!h1.id) h1.id = popup.id + '-title';
            popup.setAttribute('aria-labelledby', h1.id);
        }

        var box = popup.querySelector('.popup-box');
        if (box) {
            box.setAttribute('tabindex', '-1');
            box.focus();
        }
    }

    function closePopup(popup) {
        if (layout) layout.removeAttribute('inert');
        document.body.classList.remove('popup-open');
        if (lastTrigger && document.contains(lastTrigger)) {
            lastTrigger.focus();
        }
    }

    function sync() {
        var open = currentPopup();
        document.querySelectorAll('.popup-overlay').forEach(function (popup) {
            if (popup !== open) closePopup(popup);
        });
        if (open) openPopup(open);
    }

    document.querySelectorAll('.pcard').forEach(function (card) {
        card.addEventListener('click', function () {
            lastTrigger = card;
        });
    });

    document.addEventListener('keydown', function (e) {
        if (e.key !== 'Escape') return;
        var open = currentPopup();
        if (!open) return;
        var back = open.querySelector('.popup-back');
        if (back) back.click();
    });

    window.addEventListener('hashchange', sync);
    sync();
})();

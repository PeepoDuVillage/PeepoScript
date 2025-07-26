// ==UserScript==
// @name         PeepoScript
// @namespace    Peepo
// @version      3.1
// @description  Ajout d'un mode clair pour le bouton d'options.
// @icon         https://village.cx/favicon.ico
// @author       Peepo
// @match        https://village.cx/*
// @updateURL    https://raw.githubusercontent.com/PeepoDuVillage/PeepoScript/master/PeepoScript.js
// @downloadURL  https://raw.githubusercontent.com/PeepoDuVillage/PeepoScript/master/PeepoScript.js
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    // --- DOM Cache et d'autres éléments---
    const domCache = {
        messageSelectors: '.message',
        pseudoSelectors: '.message-user span.font-medium',
        topicSelectors: 'a.row-center.py-1.w-full'
    };
    let contextMenu = null;

    // --- Utility Functions ---
    function validateAndSanitizeUsername(input) {
        if (typeof input !== 'string' || !input.trim()) return null;
        const cleanedInput = input.trim();
        if (cleanedInput.length > 50) return null;
        const allowedPattern = /^[a-zA-Z0-9\s_-]+$/;
        if (!allowedPattern.test(cleanedInput)) return null;
        return cleanedInput.toLowerCase();
    }

    function debounce(func, wait) {
        let timeout;
        return function (...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }

    // --- Storage Management ---
    let blacklist = (JSON.parse(localStorage.getItem('blacklistVillageCX')) || []).map(name => name.toLowerCase());
    let highlightList = (JSON.parse(localStorage.getItem('highlightListVillageCX')) || []).map(name => name.toLowerCase());
    let disableConfirmation = JSON.parse(localStorage.getItem('disableConfirmation')) || false;
    let oledThemeEnabled = JSON.parse(localStorage.getItem('oledThemeVillageCX')) || false;
    let lightModeButton = JSON.parse(localStorage.getItem('lightModeButton')) || false; // New setting

    function saveBlacklist() { localStorage.setItem('blacklistVillageCX', JSON.stringify(blacklist)); }
    function saveHighlightList() { localStorage.setItem('highlightListVillageCX', JSON.stringify(highlightList)); }
    function saveConfirmationSetting() { localStorage.setItem('disableConfirmation', JSON.stringify(disableConfirmation)); }
    function saveOledThemePreference() { localStorage.setItem('oledThemeVillageCX', JSON.stringify(oledThemeEnabled)); }
    function saveLightModeButton() { localStorage.setItem('lightModeButton', JSON.stringify(lightModeButton)); } // New save function

    // --- Core Features: Blacklist & Highlights ---
    function addToBlacklist(pseudo) {
        const sanitizedPseudo = validateAndSanitizeUsername(pseudo);
        if (!sanitizedPseudo) { showNotification("Nom d'utilisateur invalide.", true); return; }
        if (blacklist.includes(sanitizedPseudo)) { showNotification(`"${sanitizedPseudo}" est déjà dans la blacklist.`, true); return; }
        if (!disableConfirmation && !confirm(`Voulez-vous vraiment blacklister ${sanitizedPseudo} ?`)) { return; }
        blacklist.push(sanitizedPseudo);
        saveBlacklist();
        refreshAll(true);
        showNotification(`"${sanitizedPseudo}" a été ajouté à la blacklist.`);
    }

    function removeFromBlacklist(pseudo) {
        blacklist = blacklist.filter(n => n !== pseudo.toLowerCase());
        saveBlacklist();
        showNotification(`"${pseudo}" a été retiré de la blacklist.`);
        refreshAll(true);
    }

    function addToHighlightList(pseudo) {
        const sanitizedPseudo = validateAndSanitizeUsername(pseudo);
        if (!sanitizedPseudo) { showNotification("Nom d'utilisateur invalide.", true); return; }
        if (!highlightList.includes(sanitizedPseudo)) {
            highlightList.push(sanitizedPseudo);
            saveHighlightList();
            refreshAll(true);
            showNotification(`"${sanitizedPseudo}" a été ajouté aux favoris.`);
        }
    }

    function removeFromHighlightList(pseudo) {
        highlightList = highlightList.filter(n => n !== pseudo.toLowerCase());
        saveHighlightList();
        showNotification(`"${pseudo}" a été retiré des favoris.`);
        refreshAll(true);
    }

    // --- Media Integration ---
    function integrateVocaroo(msg) {
        const vocarooLinks = msg.querySelectorAll('a[href*="vocaroo.com"], a[href*="voca.ro"]');
        vocarooLinks.forEach(link => {
            if (link.dataset.embedded) return;
            try {
                const url = new URL(link.href);
                const match = url.pathname.match(/^\/([a-zA-Z0-9]+)$/);
                const isSafeDomain = url.hostname === 'vocaroo.com' || url.hostname === 'www.vocaroo.com' || url.hostname === 'voca.ro';
                if (isSafeDomain && match) {
                    const vocarooId = match[1];
                    const iframe = document.createElement('iframe');
                    iframe.src = `https://vocaroo.com/embed/${vocarooId}?autoplay=0`;
                    iframe.width = "300";
                    iframe.height = "60";
                    iframe.frameBorder = "0";
                    iframe.allow = "autoplay";
                    link.parentNode.replaceChild(iframe, link);
                    link.dataset.embedded = "true";
                }
            } catch (e) { /* Invalid URL, ignore */ }
        });
    }

    function integrateImages(msg) {
        const imageLinks = msg.querySelectorAll('a[href*="risibank.fr"], a[href*="noelshack.com"]');
        imageLinks.forEach(link => {
            if (link.dataset.embedded) return;
            try {
                const url = new URL(link.href);
                const isSafeDomain = url.hostname === 'risibank.fr' || url.hostname === 'www.risibank.fr' || url.hostname === 'image.noelshack.com';
                if (isSafeDomain && url.pathname.match(/\.(png|jpg|jpeg|gif|webp)$/i)) {
                    const img = document.createElement('img');
                    img.src = link.href;
                    img.alt = 'Image intégrée';
                    img.style.maxWidth = '200px';
                    img.style.maxHeight = '200px';
                    img.style.cursor = 'pointer';
                    img.onclick = () => window.open(link.href, '_blank');
                    link.parentNode.replaceChild(img, link);
                    link.dataset.embedded = "true";
                }
            } catch (e) { /* Invalid URL, ignore */ }
        });
    }

    // --- UI Manipulation ---
    function applyStyling() {
        document.querySelectorAll(domCache.messageSelectors).forEach(msg => {
            const pseudoElement = msg.querySelector(domCache.pseudoSelectors);
            if (!pseudoElement) return;
            const pseudoLower = pseudoElement.innerText.trim().toLowerCase();
            if (blacklist.includes(pseudoLower)) {
                msg.style.display = 'none';
            } else {
                msg.style.display = '';
                pseudoElement.style.color = highlightList.includes(pseudoLower) ? '#FFD700' : '';
                integrateVocaroo(msg);
                integrateImages(msg);
            }
        });
        document.querySelectorAll(domCache.topicSelectors).forEach(topic => {
            const pseudoElement = topic.querySelector('.row-center.text-sm span');
            if (pseudoElement) {
                const pseudoLower = pseudoElement.textContent.trim().toLowerCase();
                const parentDiv = topic.closest('div[class*="ease-linear"]')?.parentElement;
                if (parentDiv) { parentDiv.style.display = blacklist.includes(pseudoLower) ? 'none' : ''; }
                pseudoElement.style.color = highlightList.includes(pseudoLower) ? '#FFD700' : '';
            }
        });
        document.querySelectorAll('.message-header > button > div').forEach(quote => {
            const pseudoElement = quote.querySelector('span.font-medium');
            if (pseudoElement) {
                const pseudoLower = pseudoElement.textContent.trim().toLowerCase();
                quote.style.display = blacklist.includes(pseudoLower) ? 'none' : '';
            }
        });
    }

    // --- Right-Click Context Menu ---
    function createContextMenu() {
        contextMenu = document.createElement('div');
        contextMenu.id = 'peeposcript-context-menu';
        contextMenu.style.cssText = 'display: none; position: fixed; z-index: 10001; background-color: #2a2a2a; border: 1px solid #444; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.4); padding: 5px; min-width: 150px;';
        document.body.appendChild(contextMenu);
    }

    function showContextMenu(e) {
        const targetPseudo = e.target.closest(domCache.pseudoSelectors);
        if (!targetPseudo) { hideContextMenu(); return; }

        e.preventDefault();
        const pseudo = targetPseudo.innerText.trim();
        const pseudoLower = pseudo.toLowerCase();
        const isBlacklisted = blacklist.includes(pseudoLower);
        const isFavorited = highlightList.includes(pseudoLower);

        contextMenu.innerHTML = `
            <button data-action="blacklist" class="peepo-menu-item">${isBlacklisted ? '✅ Retirer de la' : '🚫'} Blacklist</button>
            <button data-action="favorite" class="peepo-menu-item">${isFavorited ? '✅ Retirer des' : '⭐'} Favoris</button>
        `;
        contextMenu.querySelectorAll('.peepo-menu-item').forEach(button => {
            button.style.cssText = 'display: block; width: 100%; padding: 8px 12px; text-align: left; background: none; border: none; color: white; cursor: pointer; border-radius: 4px;';
            button.onmouseenter = () => button.style.backgroundColor = '#4a4a4a';
            button.onmouseleave = () => button.style.backgroundColor = 'transparent';
        });
        contextMenu.querySelector('[data-action="blacklist"]').onclick = () => { isBlacklisted ? removeFromBlacklist(pseudo) : addToBlacklist(pseudo); hideContextMenu(); };
        contextMenu.querySelector('[data-action="favorite"]').onclick = () => { isFavorited ? removeFromHighlightList(pseudo) : addToHighlightList(pseudo); hideContextMenu(); };
        
        contextMenu.style.visibility = 'hidden';
        contextMenu.style.display = 'block';
        const menuHeight = contextMenu.offsetHeight;
        const menuWidth = contextMenu.offsetWidth;
        const winWidth = window.innerWidth;
        let top = e.clientY - menuHeight;
        let left = e.clientX;
        if (top < 10) { top = e.clientY + 10; }
        if (left + menuWidth > winWidth - 10) { left = winWidth - menuWidth - 10; }
        contextMenu.style.top = `${top}px`;
        contextMenu.style.left = `${left}px`;
        contextMenu.style.visibility = 'visible';
    }

    function hideContextMenu() {
        if (contextMenu) { contextMenu.style.display = 'none'; }
    }

    // --- Options Panel ---
    function applyButtonStyle() {
        const btn = document.getElementById('options-btn');
        if (!btn) return;

        if (lightModeButton) {
            btn.style.background = '#f0f0f0';
            btn.style.color = 'black';
            btn.style.border = '1px solid #ccc';
        } else {
            btn.style.background = '#222';
            btn.style.color = 'white';
            btn.style.border = '1px solid #555';
        }
    }
    
    function createManageButton() {
        if (document.getElementById('options-btn')) return;
        const savedLeft = parseInt(localStorage.getItem('blacklistBtnLeftVillageCX') || '10', 10);
        const btn = document.createElement('button');
        btn.textContent = '⚙️ Options';
        btn.id = 'options-btn';
        btn.style.position = 'fixed';
        btn.style.top = '10px';
        btn.style.left = `${savedLeft}px`;
        btn.style.zIndex = '10000';
        btn.style.fontSize = '14px';
        btn.style.padding = '6px 12px';
        btn.style.borderRadius = '6px';
        btn.style.cursor = 'pointer';
        
        applyButtonStyle();

        btn.onclick = toggleOptionsPanel;
        document.body.appendChild(btn);
    }
    function toggleOptionsPanel() {
        const panel = document.getElementById('options-panel');
        if (panel) { panel.remove(); } else { showOptionsPanel(); }
    }
    function showOptionsPanel() {
        const panel = document.createElement('div');
        panel.id = 'options-panel';
        panel.style.cssText = 'position: fixed; left: 50%; top: 50%; transform: translate(-50%, -50%); background: #1a1a1a; color: white; padding: 20px; border-radius: 12px; z-index: 10001; max-height: 90vh; overflow-y: auto; width: 600px; box-shadow: 0 4px 20px rgba(0,0,0,0.5); resize: both; border: 1px solid #444;';
        const savedPos = localStorage.getItem('optionsPanelPosition');
        if (savedPos) {
            const { x, y } = JSON.parse(savedPos);
            panel.style.left = `${x}px`;
            panel.style.top = `${y}px`;
            panel.style.transform = 'none';
        }
        const title = document.createElement('div');
        title.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; cursor: move; user-select: none;';
        title.innerHTML = `<h2 style="margin: 0; font-size: 20px;">Options PeepoScript</h2><button id="close-options-btn" style="background: none; border: none; color: #888; cursor: pointer; font-size: 24px;">&times;</button>`;
        panel.appendChild(title);
        title.querySelector('#close-options-btn').onclick = () => panel.remove();
        let isDragging = false;
        title.onmousedown = (e) => {
            if (e.target.id === 'close-options-btn') return;
            isDragging = true;
            const initialX = e.clientX - panel.offsetLeft;
            const initialY = e.clientY - panel.offsetTop;
            document.onmousemove = (moveEvent) => {
                if (!isDragging) return;
                panel.style.left = `${moveEvent.clientX - initialX}px`;
                panel.style.top = `${moveEvent.clientY - initialY}px`;
                panel.style.transform = 'none';
            };
            document.onmouseup = () => {
                isDragging = false; document.onmousemove = null; document.onmouseup = null;
                localStorage.setItem('optionsPanelPosition', JSON.stringify({ x: panel.offsetLeft, y: panel.offsetTop }));
            };
        };
        const content = document.createElement('div');
        content.style.cssText = 'display: flex; flex-direction: column; gap: 20px;';
        panel.appendChild(content);
        const blacklistSection = document.createElement('div');
        const featuresSection = document.createElement('div');
        content.appendChild(blacklistSection);
        content.appendChild(featuresSection);
        document.body.appendChild(panel);
        updateOptionsPanel();
    }
    function updateOptionsPanel() {
        const panel = document.getElementById('options-panel');
        if (!panel) return;
        const blacklistSection = panel.querySelector('div:first-of-type');
        const featuresSection = panel.querySelector('div:last-of-type');
        updateBlacklistSection(blacklistSection);
        updateFeaturesSection(featuresSection);
    }
    function createStyledUserList(container, title, list, color, removeAction) {
        container.innerHTML = `<h3 style="margin: 0 0 10px 0; color: ${color};">${title}</h3>`;
        const listContainer = document.createElement('div');
        listContainer.style.cssText = 'display: flex; flex-direction: column; gap: 8px; max-height: 200px; overflow-y: auto; padding: 5px; background-color: #222; border-radius: 4px;';
        if (list.length === 0) { listContainer.innerHTML = '<p style="padding: 10px; text-align: center;"><i>La liste est vide.</i></p>'; }
        else {
            list.slice().sort().forEach(name => {
                const row = document.createElement('div');
                row.style.cssText = `display: flex; justify-content: space-between; align-items: center; padding: 8px 10px; background-color: #2a2a2a; border-radius: 8px; border-left: 3px solid ${color};`;
                const span = document.createElement('span');
                span.textContent = name;
                const delBtn = document.createElement('button');
                delBtn.innerHTML = '❌';
                delBtn.style.cssText = `background: none; border: none; cursor: pointer; font-size: 16px; color: ${color};`;
                delBtn.onclick = () => removeAction(name);
                row.appendChild(span);
                row.appendChild(delBtn);
                listContainer.appendChild(row);
            });
        }
        container.appendChild(listContainer);
    }
    function updateBlacklistSection(section) {
        if (!section) return;
        createStyledUserList(section, "Blacklist", blacklist, '#ff6b6b', removeFromBlacklist);
        const addFormContainer = document.createElement('div');
        addFormContainer.style.cssText = 'display: flex; gap: 5px; margin-top: 10px;';
        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = 'Nom à blacklister';
        input.style.cssText = 'flex-grow: 1; padding: 5px; border-radius: 4px; border: 1px solid #444; background: #222; color: white;';
        const addButton = document.createElement('button');
        addButton.textContent = 'Ajouter';
        addButton.style.cssText = 'padding: 5px 10px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer;';
        const handleAdd = () => { if (input.value.trim()) { addToBlacklist(input.value); input.value = ''; updateOptionsPanel(); } };
        addButton.onclick = handleAdd;
        input.onkeypress = (e) => { if (e.key === 'Enter') handleAdd(); };
        addFormContainer.appendChild(input);
        addFormContainer.appendChild(addButton);
        section.appendChild(addFormContainer);
    }
    function updateFeaturesSection(section) {
        if (!section) return;
        createStyledUserList(section, "Favoris", highlightList, '#FFD700', removeFromHighlightList);
        const settingsContainer = document.createElement('div');
        settingsContainer.style.marginTop = '20px';
        settingsContainer.innerHTML = `<h3 style="margin: 20px 0 10px 0; color: #4CAF50; border-top: 1px solid #333; padding-top: 20px;">Paramètres</h3>`;
        
        const confirmLabel = document.createElement('label');
        confirmLabel.style.cssText = 'display: block; margin-bottom: 15px; cursor: pointer;';
        const confirmCheckbox = document.createElement('input');
        confirmCheckbox.type = 'checkbox';
        confirmCheckbox.checked = disableConfirmation;
        confirmCheckbox.onchange = (e) => { disableConfirmation = e.target.checked; saveConfirmationSetting(); };
        confirmLabel.appendChild(confirmCheckbox);
        confirmLabel.appendChild(document.createTextNode(' Désactiver la confirmation de blacklist'));
        settingsContainer.appendChild(confirmLabel);
        
        // --- NEW: Toggle for light mode button ---
        const lightButtonLabel = document.createElement('label');
        lightButtonLabel.style.cssText = 'display: block; margin-bottom: 15px; cursor: pointer;';
        const lightButtonCheckbox = document.createElement('input');
        lightButtonCheckbox.type = 'checkbox';
        lightButtonCheckbox.checked = lightModeButton;
        lightButtonCheckbox.onchange = (e) => {
            lightModeButton = e.target.checked;
            saveLightModeButton();
            applyButtonStyle();
        };
        lightButtonLabel.appendChild(lightButtonCheckbox);
        lightButtonLabel.appendChild(document.createTextNode(" Bouton d'options en mode clair"));
        settingsContainer.appendChild(lightButtonLabel);

        const sliderContainer = document.createElement('div');
        sliderContainer.style.marginBottom = '15px';
        const sliderLabel = document.createElement('label');
        sliderLabel.textContent = "Position du bouton d'options";
        sliderLabel.style.display = 'block';
        sliderLabel.style.marginBottom = '5px';
        const slider = document.createElement('input');
        slider.type = 'range';
        slider.min = '10';
        slider.max = '500';
        const savedLeft = localStorage.getItem('blacklistBtnLeftVillageCX') || '10';
        slider.value = savedLeft;
        const sliderValueSpan = document.createElement('span');
        sliderValueSpan.textContent = ` ${savedLeft}px`;
        sliderValueSpan.style.marginLeft = '10px';
        slider.oninput = () => {
            const btn = document.getElementById('options-btn');
            if (btn) btn.style.left = `${slider.value}px`;
            sliderValueSpan.textContent = ` ${slider.value}px`;
            localStorage.setItem('blacklistBtnLeftVillageCX', slider.value);
        };
        sliderContainer.appendChild(sliderLabel);
        sliderContainer.appendChild(slider);
        sliderContainer.appendChild(sliderValueSpan);
        settingsContainer.appendChild(sliderContainer);

        const oledBtn = document.createElement('button');
        oledBtn.style.cssText = 'padding: 10px; background: #222; color: white; border: 1px solid #666; border-radius: 6px; cursor: pointer; width: 100%; margin-top: 10px;';
        oledBtn.textContent = oledThemeEnabled ? '🖤 Thème OLED Activé' : '🤍 Thème OLED Désactivé';
        oledBtn.onclick = () => { toggleOLEDTheme(); oledBtn.textContent = oledThemeEnabled ? '🖤 Thème OLED Activé' : '🤍 Thème OLED Désactivé'; };
        settingsContainer.appendChild(oledBtn);
        section.appendChild(settingsContainer);
    }
    const oledStyleID = 'peeposcript-oled-style';
    function applyOLEDTheme() {
        if (document.getElementById(oledStyleID)) return;
        const style = document.createElement('style');
        style.id = oledStyleID;
        style.textContent = `
            body.oled-theme-enabled { background-color: #000 !important; color: #e0e0e0 !important; }
            body.oled-theme-enabled div, body.oled-theme-enabled header, body.oled-theme-enabled footer, body.oled-theme-enabled section, body.oled-theme-enabled article, body.oled-theme-enabled main, body.oled-theme-enabled aside, body.oled-theme-enabled nav, body.oled-theme-enabled form { background-color: transparent !important; border-color: #333 !important; color: #e0e0e0 !important; }
            body.oled-theme-enabled > div, body.oled-theme-enabled menu { background-color: #1a1a1a !important; }
            body.oled-theme-enabled #options-panel { background-color: #1a1a1a !important; }
            body.oled-theme-enabled .message { background-color: #111 !important; }
            body.oled-theme-enabled input, body.oled-theme-enabled textarea, body.oled-theme-enabled button { background-color: #222 !important; color: #e0e0e0 !important; border-color: #444 !important; }
            body.oled-theme-enabled button.primary { background-color: #36a !important; }
        `;
        document.head.appendChild(style);
        document.body.classList.add('oled-theme-enabled');
    }
    function removeOLEDTheme() {
        const style = document.getElementById(oledStyleID);
        if (style) style.remove();
        document.body.classList.remove('oled-theme-enabled');
    }
    function toggleOLEDTheme() {
        oledThemeEnabled = !oledThemeEnabled;
        if (oledThemeEnabled) { applyOLEDTheme(); } else { removeOLEDTheme(); }
        saveOledThemePreference();
    }
    function showNotification(message, isError = false) {
        const notification = document.createElement('div');
        notification.textContent = message;
        notification.style.cssText = `position: fixed; bottom: 20px; right: 20px; padding: 12px 20px; border-radius: 4px; color: white; background-color: ${isError ? '#f44336' : '#4CAF50'}; box-shadow: 0 2px 10px rgba(0,0,0,0.2); z-index: 10002; opacity: 0; transition: opacity 0.3s;`;
        document.body.appendChild(notification);
        setTimeout(() => { notification.style.opacity = '1'; }, 10);
        setTimeout(() => {
            notification.style.opacity = '0';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }
    let observer;
    function startObserver() {
        if (observer) observer.disconnect();
        const targetNode = document.body;
        if (!targetNode) return;
        const debouncedRefresh = debounce(() => refreshAll(), 300);
        observer = new MutationObserver(debouncedRefresh);
        observer.observe(targetNode, { childList: true, subtree: true });
    }
    function refreshAll(force = false) {
        if (!force && document.getElementById('options-panel')?.contains(document.activeElement)) { return; }
        applyStyling();
        if (document.getElementById('options-panel')) { updateOptionsPanel(); }
    }
    function initialize() {
        if (oledThemeEnabled) { applyOLEDTheme(); }
        createManageButton();
        createContextMenu();
        document.addEventListener('contextmenu', showContextMenu);
        document.addEventListener('click', hideContextMenu);
        refreshAll(true);
        startObserver();
    }
    if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', initialize); }
    else { initialize(); }

})();
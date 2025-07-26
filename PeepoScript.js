// ==UserScript==
// @name         PeepoScript
// @namespace    Peepo
// @version      1.7
// @description  Blacklist et Favori combinés pour Village.cx version Alpha
// @icon         https://village.cx/favicon.ico
// @author       Peepo
// @match        https://village.cx/*
// @updateURL    https://raw.githubusercontent.com/PeepoDuVillage/PeepoScript/master/PeepoScript.js
// @downloadURL  https://raw.githubusercontent.com/PeepoDuVillage/PeepoScript/master/PeepoScript.js
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    // Cache des sélecteurs fréquemment utilisés
    const domCache = {
        optionsPanel: null,
        blacklistBtn: null,
        messageSelectors: '.message',
        pseudoSelectors: '.message-user span.font-medium',
        topicSelectors: 'a.row-center.py-1.w-full'
    };

    // --- Stockage ---
    let blacklist = JSON.parse(localStorage.getItem('blacklistVillageCX')) || [];
    blacklist = blacklist.map(name => name.toLowerCase());
    let highlightList = JSON.parse(localStorage.getItem('highlightListVillageCX')) || [];
    highlightList = highlightList.map(name => name.toLowerCase());
    let disableConfirmation = JSON.parse(localStorage.getItem('disableConfirmation')) || false;

    // --- Stockage Silent Typing ---
    let silentTypingEnabled = localStorage.getItem('silentTypingEnabled') === 'true';
    
    // --- Sauvegarde ---
    function saveBlacklist() {
        localStorage.setItem('blacklistVillageCX', JSON.stringify(blacklist));
    }
    function saveHighlightList() {
        localStorage.setItem('highlightListVillageCX', JSON.stringify(highlightList));
    }
    function saveConfirmationSetting() {
        localStorage.setItem('disableConfirmation', JSON.stringify(disableConfirmation));
    }

    // --- Ajout/Suppression Blacklist/Favori ---
    function addToBlacklist(pseudo) {
        const sanitizedPseudo = validateAndSanitizeUsername(pseudo);
        if (!sanitizedPseudo) {
            showNotification("Nom d'utilisateur invalide ou dangereux.", true);
            return false;
        }

        if (!blacklist.includes(sanitizedPseudo)) {
            if (!disableConfirmation && !confirm(`Voulez-vous vraiment blacklister ${sanitizedPseudo} ?`)) return false;
            blacklist.push(sanitizedPseudo);
            saveBlacklist();
            refreshAll();
            showNotification(`"${sanitizedPseudo}" a été ajouté à la blacklist.`);
            return true;
        } else {
            showNotification(`"${sanitizedPseudo}" est déjà dans la blacklist.`, true);
            return false;
        }
    }
    function removeFromBlacklist(name) {
        blacklist = blacklist.filter(n => n !== name);
        saveBlacklist();
        showNotification(`"${name}" a été retiré de la blacklist.`);
        setTimeout(() => refreshAll(true), 0); // Rafraîchit immédiatement après la suppression
    }
    function addToHighlightList(pseudo) {
        const sanitizedPseudo = validateAndSanitizeUsername(pseudo);
        if (!sanitizedPseudo) {
            showNotification("Nom d'utilisateur invalide ou dangereux.", true);
            return false;
        }

        if (!highlightList.includes(sanitizedPseudo)) {
            highlightList.push(sanitizedPseudo);
            saveHighlightList();
            refreshAll();
            showNotification(`"${sanitizedPseudo}" a été ajouté aux favoris.`);
        }
    }
    function removeFromHighlightList(name) {
        highlightList = highlightList.filter(n => n !== name);
        saveHighlightList();
        refreshAll();
        showNotification(`"${name}" a été retiré des favoris.`);
    }

    // --- Affichage boutons et couleur ---
    function insertButtons(msg, pseudo) {
        const pseudoElement = msg.querySelector('.message-user span.font-medium');
        if (!pseudoElement) return;

        // Créer ou réutiliser le conteneur
        let container = pseudoElement.parentElement;
        if (!container.classList.contains('pseudo-container')) {
            container = document.createElement('span');
            container.className = 'pseudo-container';
            container.style.display = 'inline-flex';
            container.style.alignItems = 'center';
            pseudoElement.parentNode.replaceChild(container, pseudoElement);
            container.appendChild(pseudoElement);
        }

        // Nettoyer anciens boutons
        container.querySelectorAll('.blacklist-btn, .highlight-btn').forEach(btn => btn.remove());

        // Choix de l'icône selon la préférence
        let useCrossIcon = localStorage.getItem('blacklistUseCrossIcon') === '1';
        const blBtn = document.createElement('button');
        blBtn.textContent = useCrossIcon ? '❌' : '🚫';
        blBtn.title = `Blacklist ${pseudo}`;
        blBtn.className = 'blacklist-btn';
        blBtn.style.cssText = `
            margin-left: 8px;
            margin-right: 4px;
            font-size: 13px;
            background: transparent;
            border: none;
            cursor: pointer;
            display: inline-block;
            vertical-align: middle;
        `;
        blBtn.onclick = (e) => {
            e.stopPropagation();
            e.preventDefault();
            if (blacklist.includes(pseudo.toLowerCase())) {
                removeFromBlacklist(pseudo.toLowerCase());
            } else {
                addToBlacklist(pseudo);
            }
        };

        // Bouton favori ⭐
        const favBtn = document.createElement('button');
        favBtn.textContent = '⭐';
        favBtn.title = `Mettre en favori ${pseudo}`;
        favBtn.className = 'highlight-btn';
        favBtn.style.cssText = `
            margin-left: 0px;
            font-size: 14px;
            background: transparent;
            border: none;
            cursor: pointer;
            display: inline-block;
            vertical-align: middle;
            position: relative;
            top: -1px;
        `;
        favBtn.onclick = (e) => {
            e.stopPropagation();
            e.preventDefault();
            if (highlightList.includes(pseudo.toLowerCase())) {
                removeFromHighlightList(pseudo.toLowerCase());
            } else {
                addToHighlightList(pseudo);
            }
        };

        // Réordonner : pseudo, 🚫/❌, ⭐
        while (container.firstChild) container.removeChild(container.firstChild);
        container.appendChild(pseudoElement);
        container.appendChild(blBtn);
        container.appendChild(favBtn);

        // Couleur du pseudo si favori
        if (highlightList.includes(pseudo.toLowerCase())) {
            pseudoElement.style.color = '#FFD700';
        } else {
            pseudoElement.style.color = '';
        }
    }

    // --- Masquage des messages blacklistés ---
    function hideMessages() {
        document.querySelectorAll(domCache.messageSelectors).forEach(msg => {
            const pseudoElement = msg.querySelector(domCache.pseudoSelectors);
            if (!pseudoElement) return;

            const pseudo = pseudoElement.innerText.trim();
            const pseudoLower = pseudo.toLowerCase();
            
            // Toujours insérer les boutons
            insertButtons(msg, pseudo);
            
            if (blacklist.includes(pseudoLower)) {
                msg.style.display = 'none';
            } else {
                msg.style.display = '';
                if (msg.querySelectorAll('a[href*="vocaroo.com"], a[href*="voca.ro"]').length) {
                    integrateVocaroo(msg);
                }
                if (msg.querySelectorAll('a[href*="risibank.fr"], a[href*="noelshack.com"]').length) {
                    integrateImages(msg);
                }
            }
        });
    }

    // --- Mise en évidence des pseudos favoris dans les topics ---
    function highlightTopics() {
        document.querySelectorAll('a.row-center.py-1.w-full .row-center.text-sm span').forEach(pseudoElement => {
            try {
                const pseudo = pseudoElement.textContent.trim().toLowerCase();
                if (highlightList.includes(pseudo)) {
                    pseudoElement.style.color = '#FFD700';
                } else {
                    pseudoElement.style.color = '';
                }
            } catch (e) {}
        });
    }

    // --- Masquage des topics blacklistés ---
    function hideTopics() {
        document.querySelectorAll(domCache.topicSelectors).forEach(topic => {
            try {
                const pseudoElement = topic.querySelector('.row-center.text-sm span');
                if (pseudoElement && blacklist.includes(pseudoElement.textContent.trim().toLowerCase())) {
                    const parentDiv = topic.closest('div[class*="ease-linear"]')?.parentElement;
                    if (parentDiv) parentDiv.style.display = 'none';
                }
            } catch (e) {}
        });
    }

    // --- Modification des citations pour les utilisateurs blacklistés ---
    function editQuotes() {
        document.querySelectorAll('.message-header > button > div').forEach(quote => {
            try {
                const pseudoElement = quote.querySelector('span.font-medium');
                if (!pseudoElement) return;

                const pseudo = pseudoElement.textContent.trim().toLowerCase();
                const isBlacklisted = blacklist.includes(pseudo);

                // Cherche si un message de remplacement existe déjà
                let replaced = quote.querySelector('.blacklist-quote-message');
                const quoteMessage = quote.querySelector('.rich-message');
                if (!quoteMessage) return;

                if (isBlacklisted) {
                    // Sauvegarde le contenu original si pas déjà fait
                    if (!quoteMessage.dataset.originalContent) {
                        quoteMessage.dataset.originalContent = quoteMessage.innerHTML;
                    }
                    // Masque pseudo/avatar et affiche le message
                    const img = quote.querySelector('img.object-cover.rounded-md.size-6');
                    if (img) img.style.display = 'none';
                    pseudoElement.style.display = 'none';

                    if (!replaced) {
                        quoteMessage.innerHTML = "";
                        const span = document.createElement('span');
                        span.textContent = "[Contenu blacklisté]";
                        span.className = "blacklist-quote-message";
                        span.style.color = "#ff6b6b";
                        quoteMessage.appendChild(span);
                    }
                } else {
                    // Restaure pseudo/avatar et contenu original
                    const img = quote.querySelector('img.object-cover.rounded-md.size-6');
                    if (img) img.style.display = '';
                    pseudoElement.style.display = '';

                    // Restaure le contenu original si sauvegardé
                    if (quoteMessage.dataset.originalContent) {
                        quoteMessage.innerHTML = quoteMessage.dataset.originalContent;
                        delete quoteMessage.dataset.originalContent;
                    }
                }
            } catch (e) {}
        });
    }

    // Debounce function
    function debounce(func, wait) {
        let timeout;
        return function (...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }

    // Observer optimisé avec debounce
    let observer;
    function startObserver() {
        if (observer) observer.disconnect();
        const debouncedRefresh = debounce(() => refreshAll(), 100);
        observer = new MutationObserver(debouncedRefresh);
        observer.observe(document.body, { 
            childList: true, 
            subtree: true,
            attributes: false,
            characterData: false
        });
    }

    function stopObserver() {
        if (observer) observer.disconnect();
    }

    // --- Rafraîchissement complet ---
    function refreshAll(force = false) {
        if (!force && document.activeElement?.closest('#options-panel')) {
            return;
        }

        stopObserver();
        
        const start = performance.now();
        
        requestAnimationFrame(() => {
            hideMessages();
            editQuotes();
            hideTopics();
            highlightTopics();
            
            if (domCache.optionsPanel) {
                updateOptionsPanel();
            }
            if (document.getElementById('highlight-panel')) {
                updateHighlightListPanel();
            }

            startObserver();
            
            console.debug('Refresh completed in', performance.now() - start, 'ms');
        });
    }

    // Mise à jour du cache DOM
    function updateDOMCache() {
        domCache.optionsPanel = document.getElementById('options-panel');
        domCache.blacklistBtn = document.getElementById('options-btn');
    }

    // --- Notifications ---
    function showNotification(message, isError = false) {
        const notification = document.createElement('div');
        notification.textContent = message;
        notification.style.position = 'fixed';
        notification.style.bottom = '20px';
        notification.style.right = '20px';
        notification.style.padding = '12px 20px';
        notification.style.borderRadius = '4px';
        notification.style.color = 'white';
        notification.style.backgroundColor = isError ? '#f44336' : '#4CAF50';
        notification.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';
        notification.style.zIndex = '10000';
        notification.style.opacity = '0';
        notification.style.transition = 'opacity 0.3s';
        document.body.appendChild(notification);
        setTimeout(() => { notification.style.opacity = '1'; }, 10);
        setTimeout(() => {
            notification.style.opacity = '0';
            setTimeout(() => { notification.remove(); }, 300);
        }, 3000);
    }

    // --- Panneau de gestion Blacklist ---
    function createManageButton() {
        try {
            // Options button seulement
            if (!document.getElementById('options-btn')) {
                const savedLeft = parseInt(localStorage.getItem('blacklistBtnLeftVillageCX') || '10', 10);
                const btn = document.createElement('button');
                btn.textContent = '⚙️ Options';
                btn.id = 'options-btn';
                btn.style.position = 'fixed';
                btn.style.top = '10px';
                btn.style.left = savedLeft + 'px';
                btn.style.zIndex = '10000';
                btn.style.fontSize = '14px';
                btn.style.padding = '6px 12px';
                btn.style.background = '#222';
                btn.style.color = 'white';
                btn.style.border = '1px solid #555';
                btn.style.borderRadius = '6px';
                btn.style.cursor = 'pointer';
                btn.onclick = toggleOptionsPanel;
                document.body.appendChild(btn);
            }
        } catch (e) {}
    }

    function toggleOptionsPanel() {
        const panel = document.getElementById('options-panel');
        if (panel) {
            panel.remove();
        } else {
            showOptionsPanel(); // Était showBlacklistPanel
        }
    }
    function showOptionsPanel() {
        const panel = document.createElement('div');
        panel.id = 'options-panel';
        panel.style.position = 'fixed';
        panel.style.left = '50%';
        panel.style.top = '50%';
        panel.style.transform = 'translate(-50%, -50%)';
        panel.style.background = 'black';
        panel.style.color = 'white';
        panel.style.padding = '20px';
        panel.style.borderRadius = '12px';
        panel.style.zIndex = '10001';
        panel.style.maxHeight = '90vh';
        panel.style.overflowY = 'auto';
        panel.style.width = '600px'; // Plus large par défaut
        panel.style.minWidth = '400px';
        panel.style.minHeight = '300px';
        panel.style.boxShadow = '0 4px 20px rgba(0,0,0,0.5)';
        panel.style.resize = 'both'; // Permet le redimensionnement
        panel.classList.add('oled-panel');

        // Restaurer la position et taille sauvegardées
        const savedPos = localStorage.getItem('optionsPanelPosition');
        if (savedPos) {
            const {x, y, width, height} = JSON.parse(savedPos);
            panel.style.transform = 'none';
            panel.style.left = x + 'px';
            panel.style.top = y + 'px';
            panel.style.width = width + 'px';
            panel.style.height = height + 'px';
        }

        // Titre du panneau avec style pour drag
        const title = document.createElement('div');
        title.innerHTML = `
            <div class="drag-handle" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; cursor: move;">
                <h2 style="margin: 0; font-size: 20px; user-select: none;">Options</h2>
                <button id="close-options-btn" style="background: none; border: none; color: #666; cursor: pointer; font-size: 20px;">×</button>
            </div>
        `;
        panel.appendChild(title);

        // Rendre le panneau déplaçable
        const dragHandle = title.querySelector('.drag-handle');
        let isDragging = false;
        let currentX;
        let currentY;
        let initialX;
        let initialY;

        dragHandle.onmousedown = (e) => {
            if (e.target.id === 'close-options-btn') return;
            isDragging = true;
            initialX = e.clientX - panel.offsetLeft;
            initialY = e.clientY - panel.offsetTop;
        };

        document.onmousemove = (e) => {
            if (!isDragging) return;
            e.preventDefault();
            currentX = e.clientX - initialX;
            currentY = e.clientY - initialY;
            panel.style.transform = 'none'; // Enlever transform initial
            panel.style.left = currentX + 'px';
            panel.style.top = currentY + 'px';
        };

        document.onmouseup = () => {
            if (!isDragging) return;
            isDragging = false;
            // Sauvegarder la position et taille
            localStorage.setItem('optionsPanelPosition', JSON.stringify({
                x: panel.offsetLeft,
                y: panel.offsetTop,
                width: panel.offsetWidth,
                height: panel.offsetHeight
            }));
        };

        // Conteneur pour les sections
        const content = document.createElement('div');
        content.style.display = 'flex';
        content.style.flexDirection = 'column';
        content.style.gap = '20px';
        
        // Section Blacklist
        const blacklistSection = document.createElement('div');
        blacklistSection.innerHTML = `<h3 style="margin: 0 0 10px 0; color: #ff6b6b;">Gestion de la Blacklist</h3>`;
        content.appendChild(blacklistSection);
        
        // Section Fonctionnalités 
        const featuresSection = document.createElement('div');
        featuresSection.innerHTML = `<h3 style="margin: 0 0 10px 0; color: #4CAF50;">Fonctionnalités</h3>`;
        content.appendChild(featuresSection);

        // Section Apparence
        const appearanceSection = document.createElement('div');
        appearanceSection.innerHTML = `<h3 style="margin: 0 0 10px 0; color: #4CAF50;">Apparence</h3>`;
        content.appendChild(appearanceSection);

        panel.appendChild(content);
        document.body.appendChild(panel);

        // Gestionnaire de fermeture
        document.getElementById('close-options-btn').onclick = () => panel.remove();

        // Mise à jour du contenu
        updateOptionsPanel(panel);
    }

    function updateOptionsPanel() {
        const panel = document.getElementById('options-panel');
        if (panel) {
            const content = panel.querySelector('div[style*="flex-direction: column"]');
            if (content) {
                const [blacklistSection, featuresSection, appearanceSection] = content.children;
                if (blacklistSection) updateBlacklistSection(blacklistSection);
                if (featuresSection) updateFeaturesSection(featuresSection);
                if (appearanceSection) updateAppearanceSection(appearanceSection);
            }
        }
    }

    function updateBlacklistSection(section) {
        // Contenu existant de updateBlacklistPanelContent mais adapté
        setSafeInnerHTML(section, `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
            <strong>Blacklist</strong>
            <div>
                <button id="blacklist-export-btn" style="background: none; border: none; color: #4CAF50; cursor: pointer; margin-right: 5px;">⤓ Exporter</button>
                <button id="blacklist-import-btn" style="background: none; border: none; color: #2196F3; cursor: pointer;">⤒ Importer</button>
            </div>
        </div>
    `);
        if (blacklist.length === 0) {
            section.innerHTML += '<p><em>Aucun utilisateur blacklisté.</em></p>';
        } else {
            const list = document.createElement('div');
            list.style.marginTop = '10px';
            blacklist.slice().sort().forEach(name => {
                const row = document.createElement('div');
                row.style.display = 'flex';
                row.style.justifyContent = 'space-between';
                row.style.alignItems = 'center';
                row.style.padding = '8px 10px';
                row.style.margin = '5px 0';
                row.style.backgroundColor = '#1a1a1a';
                row.style.borderRadius = '8px';
                row.style.borderLeft = '3px solid #ff6b6b';
                const span = document.createElement('span');
                span.textContent = name;
                span.style.fontSize = '14px';
                span.style.color = '#ffffff';
                const del = document.createElement('button');
                del.innerHTML = '❌';
                del.style.background = 'none';
                del.style.color = '#ff6b6b';
                del.style.border = 'none';
                del.style.cursor = 'pointer';
                del.style.fontSize = '16px';
                del.onclick = () => removeFromBlacklist(name);
                row.appendChild(span);
                row.appendChild(del);
                list.appendChild(row);
            });
            section.appendChild(list);
        }
        // Ajout manuel
        const addForm = document.createElement('div');
        addForm.style.marginTop = '15px';
        addForm.innerHTML = `
            <div style="display: flex; gap: 5px; margin-bottom: 10px;">
                <input type="text" id="blacklist-add-input" placeholder="Nom à blacklister"
                       style="padding: 5px; border-radius: 4px; border: 1px solid #444; background: #222; color: white; flex-grow: 1;">
                <button id="blacklist-add-btn" style="padding: 2px 6px; font-size:12px; background: #4CAF50; color: white; border: none; border-radius: 4px;">Ajouter</button>
            </div>
        `;
        section.appendChild(addForm);

        // Option confirmation
        const disableConfirmationLabel = document.createElement('div');
        disableConfirmationLabel.style.marginTop = '10px';
        disableConfirmationLabel.innerHTML = `
            <label style="display: flex; align-items: center; gap: 5px; color: white; margin-bottom: 10px;">
                <input type="checkbox" id="disable-confirmation" ${disableConfirmation ? 'checked' : ''}>
                <span>Désactiver la confirmation</span>
            </label>
        `;
        section.appendChild(disableConfirmationLabel);

        // --- Ajout de la case à cocher pour changer l'icône du bouton blacklist ---
        const iconCheckboxDiv = document.createElement('div');
        iconCheckboxDiv.style.marginTop = '10px';
        iconCheckboxDiv.innerHTML = `
            <label style="display: flex; align-items: center; gap: 5px; color: white;">
                <input type="checkbox" id="blacklist-icon-checkbox">
                <span>Icône blacklist : ❌ au lieu de 🚫</span>
            </label>
        `;
        section.appendChild(iconCheckboxDiv);

        // Récupérer l'état de l'icône depuis localStorage
        let useCrossIcon = localStorage.getItem('blacklistUseCrossIcon') === '1';
        iconCheckboxDiv.querySelector('#blacklist-icon-checkbox').checked = useCrossIcon;

        // Gestion du changement d'icône
        iconCheckboxDiv.querySelector('#blacklist-icon-checkbox').onchange = (e) => {
            useCrossIcon = e.target.checked;
            localStorage.setItem('blacklistUseCrossIcon', useCrossIcon ? '1' : '0');
            refreshAll(true);
        };

        // Après le checkbox pour l'icône, ajouter le slider
        const sliderDiv = document.createElement('div');
        sliderDiv.style.marginTop = '10px';
        const savedLeft = parseInt(localStorage.getItem('blacklistBtnLeftVillageCX') || '10', 10);
        sliderDiv.innerHTML = `
            <label style="color:white;display:flex;align-items:center;gap:8px;">
                <span>Position du bouton :</span>
                <input type="range" id="blacklist-btn-slider" min="0" max="500" value="${savedLeft}" style="flex:1;">
                <span id="blacklist-btn-slider-value">${savedLeft}px</span>
            </label>
        `;
        section.appendChild(sliderDiv);

        // Gestion du slider
        const slider = sliderDiv.querySelector('#blacklist-btn-slider');
        const sliderValue = sliderDiv.querySelector('#blacklist-btn-slider-value');
        slider.oninput = (e) => {
            const val = parseInt(e.target.value, 10);
            sliderValue.textContent = val + "px";
            const btn = document.getElementById('options-btn');
            if (btn) btn.style.left = val + "px";
            localStorage.setItem('blacklistBtnLeftVillageCX', val);
        };

        addForm.querySelector('#blacklist-add-btn').onclick = () => {
            const input = addForm.querySelector('#blacklist-add-input');
            const name = input.value.trim();
            if (name) {
                addToBlacklist(name);
                input.value = '';
            }
        };
        addForm.querySelector('#blacklist-add-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const input = addForm.querySelector('#blacklist-add-input');
                const name = input.value.trim();
                if (name) {
                    addToBlacklist(name);
                    input.value = '';
                }
            }
        });
        section.querySelector('#disable-confirmation').onchange = (e) => {
            disableConfirmation = e.target.checked;
            saveConfirmationSetting();
        };
        section.querySelector('#blacklist-export-btn').onclick = exportBlacklist;
        section.querySelector('#blacklist-import-btn').onclick = importBlacklist;
    }
    function updateFeaturesSection(section) {
        const container = document.createElement('div');
        container.style.display = 'flex';
        container.style.flexDirection = 'column';
        container.style.gap = '10px';

        // Silent Typing Toggle
        const silentTypingBtn = document.createElement('button');
        silentTypingBtn.style.padding = '10px';
        silentTypingBtn.style.background = silentTypingEnabled ? '#555' : '#222';
        silentTypingBtn.style.color = 'white';
        silentTypingBtn.style.border = '1px solid #666';
        silentTypingBtn.style.borderRadius = '6px';
        silentTypingBtn.style.cursor = 'pointer';
        silentTypingBtn.style.width = '100%';
        silentTypingBtn.textContent = silentTypingEnabled ? '🔇 Silent Typing Activé' : '🔊 Silent Typing Désactivé';
        silentTypingBtn.onclick = toggleSilentTyping;
        container.appendChild(silentTypingBtn);

        section.appendChild(container);

        // Section Favoris
        const favorisSection = document.createElement('div');
        favorisSection.style.marginTop = '20px';
        setSafeInnerHTML(favorisSection, '<h4 style="margin: 0 0 10px 0; color: #FFD700;">Liste des Favoris</h4>');

        if (highlightList.length === 0) {
            favorisSection.innerHTML += '<p><em>Aucun favori.</em></p>';
        } else {
            const list = document.createElement('div');
            list.style.marginTop = '10px';
            highlightList.slice().sort().forEach(name => {
                const row = document.createElement('div');
                row.style.display = 'flex';
                row.style.justifyContent = 'space-between';
                row.style.alignItems = 'center';
                row.style.padding = '8px 10px';
                row.style.margin = '5px 0';
                row.style.backgroundColor = '#1a1a1a';
                row.style.borderRadius = '8px';
                row.style.borderLeft = '3px solid #FFD700';
                
                const span = document.createElement('span');
                span.textContent = name;
                span.style.fontSize = '14px';
                span.style.color = '#ffffff';
                
                const del = document.createElement('button');
                del.innerHTML = '❌';
                del.style.background = 'none';
                del.style.color = '#FFD700';
                del.style.border = 'none';
                del.style.cursor = 'pointer';
                del.style.fontSize = '16px';
                del.onclick = () => removeFromHighlightList(name);
                
                row.appendChild(span);
                row.appendChild(del);
                list.appendChild(row);
            });
            favorisSection.appendChild(list);
        }

        section.appendChild(favorisSection);
    }

    function updateAppearanceSection(section) {
        const container = document.createElement('div');
        container.style.display = 'flex';
        container.style.flexDirection = 'column';
        container.style.gap = '10px';

        // OLED Theme Toggle
        const oledBtn = document.createElement('button');
        oledBtn.style.padding = '10px';
        oledBtn.style.background = document.body.classList.contains('oled-theme-enabled') ? '#555' : '#222';
        oledBtn.style.color = 'white';
        oledBtn.style.border = '1px solid #666';
        oledBtn.style.borderRadius = '6px';
        oledBtn.style.cursor = 'pointer';
        oledBtn.style.width = '100%';
        oledBtn.textContent = document.body.classList.contains('oled-theme-enabled') ? '🖤 OLED Activé' : '🤍 OLED Désactivé';
        oledBtn.onclick = toggleOLEDTheme;
        container.appendChild(oledBtn);

        section.appendChild(container);
    }

    // --- Modification de initialize() ---
    function initialize() {
        // OLED mode: restore state from localStorage
        if (localStorage.getItem('oledThemeVillageCX') === '1') {
            document.body.classList.add('oled-theme-enabled');
            if (!document.getElementById('oled-theme-style')) {
                const style = document.createElement('style');
                style.id = 'oled-theme-style';
                style.textContent = `
                    body.oled-theme-enabled {
                        background: #000 !important;
                        color: #fff !important;
                    }
                    body.oled-theme-enabled *:not(.oled-panel) {
                        background: transparent !important;
                        border-color: #222 !important;
                    }
                    body.oled-theme-enabled .oled-panel {
                        background: #000 !important;
                    }
                `;
                document.head.appendChild(style);
            }
            // Ajout du style menu contextuel OLED (hors scope du style précédent)
            if (!document.getElementById('oled-menu-style')) {
                const menuStyle = document.createElement('style');
                menuStyle.id = 'oled-menu-style';
                menuStyle.textContent = `
                    body.oled-theme-enabled menu.fixed {
                        background: #111 !important;
                        color: #fff !important;
                        border-radius: 8px !important;
                        border: 1px solid #222 !important;
                        box-shadow: 0 2px 10px #000a !important;
                    }
                    body.oled-theme-enabled menu.fixed * {
                        background: transparent !important;
                        color: #fff !important;
                    }
                    body.oled-theme-enabled menu.fixed button {
                        background: transparent !important;
                        color: #fff !important;
                        border: none !important;
                    }
                `;
                document.head.appendChild(menuStyle);
            }
        }
        updateDOMCache();
        refreshAll();
        createManageButton();
        startObserver();
        if (silentTypingEnabled) enableSilentTypingWebSocket();
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }

    // Ajoute cette fonction en dehors de createManageButton :
    function toggleOLEDTheme() {
        const enabled = document.body.classList.toggle('oled-theme-enabled');
        if (enabled) {
            localStorage.setItem('oledThemeVillageCX', '1');
            if (!document.getElementById('oled-theme-style')) {
                const style = document.createElement('style');
                style.id = 'oled-theme-style';
                style.textContent = `
                    body.oled-theme-enabled {
                        background: #000 !important;
                        color: #fff !important;
                    }
                    body.oled-theme-enabled *:not(.oled-panel) {
                        background: transparent !important;
                        border-color: #222 !important;
                    }
                    body.oled-theme-enabled .oled-panel {
                        background: #000 !important;
                    }
                `;
                document.head.appendChild(style);
            }
            // Ajout du style menu contextuel OLED
            if (!document.getElementById('oled-menu-style')) {
                const menuStyle = document.createElement('style');
                menuStyle.id = 'oled-menu-style';
                menuStyle.textContent = `
                    body.oled-theme-enabled menu.fixed {
                        background: #111 !important;
                        color: #fff !important;
                        border-radius: 8px !important;
                        border: 1px solid #222 !important;
                        box-shadow: 0 2px 10px #000a !important;
                    }
                    body.oled-theme-enabled menu.fixed * {
                        background: transparent !important;
                        color: #fff !important;
                    }
                    body.oled-theme-enabled menu.fixed button {
                        background: transparent !important;
                        color: #fff !important;
                        border: none !important;
                    }
                `;
                document.head.appendChild(menuStyle);
            }
        } else {
            localStorage.setItem('oledThemeVillageCX', '0');
            document.body.classList.remove('oled-theme-enabled');
            const style = document.getElementById('oled-theme-style');
            if (style) style.remove();
            const menuStyle = document.getElementById('oled-menu-style');
            if (menuStyle) menuStyle.remove();
        }
    }

    // --- Utilitaire pour vérifier que l'URL commence par https:// ---
    function isHttpsUrl(url) {
        try {
            return (new URL(url)).protocol === "https:";
        } catch (e) {
            return false;
        }
    }

    // --- Intégration Vocaroo ---
    function integrateVocaroo(msg) {
        // Ne traite qu'une fois chaque message
        if (msg.dataset.vocarooEmbedded === "1") return;
        const vocarooLinks = msg.querySelectorAll('a[href*="vocaroo.com"], a[href*="voca.ro"]');
        vocarooLinks.forEach(link => {
            if (link.classList.contains('vocaroo-embed')) return;
            try {
                const url = new URL(link.href);
                // Vérification stricte du nom de domaine ET du protocole https
                if (
                    url.protocol === "https:" &&
                    (
                        (url.hostname === "vocaroo.com" || url.hostname === "www.vocaroo.com") ||
                        (url.hostname === "voca.ro" || url.hostname === "www.voca.ro")
                    )
                ) {
                    const match = url.pathname.match(/^\/([a-zA-Z0-9]+)$/);
                    if (match) {
                        const vocarooId = match[1];
                        const iframe = document.createElement('iframe');
                        iframe.src = `https://vocaroo.com/embed/${vocarooId}?autoplay=0`;
                        iframe.width = "250";
                        iframe.height = "60";
                        iframe.frameBorder = "0";
                        iframe.allow = "autoplay";
                        iframe.className = "vocaroo-embed";
                        iframe.style.marginLeft = "0";
                        link.parentNode.replaceChild(iframe, link);
                    }
                }
            } catch (e) {}
        });
        msg.dataset.vocarooEmbedded = "1";
    }

    // --- Intégration Risibank et Noelshack ---
    function integrateImages(msg) {
        // Risibank (strictement risibank.fr)
        const risibankLinks = msg.querySelectorAll('a[href*="risibank.fr"]');
        risibankLinks.forEach(link => {
            if (link.classList.contains('risibank-embed')) return;
            try {
                const url = new URL(link.href);
                if (
                    url.protocol === "https:" &&
                    url.hostname === "risibank.fr"
                ) {
                    // Accepte tout lien risibank.fr qui finit par une extension d'image
                    if (url.pathname.match(/\.(png|jpg|jpeg|gif|webp)$/i)) {
                        const img = document.createElement('img');
                        img.src = link.href;
                        img.alt = 'Risibank';
                        img.style.maxWidth = '200px';
                        img.style.maxHeight = '200px';
                        img.style.verticalAlign = 'middle';
                        img.className = 'risibank-embed';
                        link.parentNode.replaceChild(img, link);
                    }
                }
            } catch (e) {}
        });

        // Noelshack (strictement image.noelshack.com)
        const noelshackLinks = msg.querySelectorAll('a[href*="noelshack.com"]');
        noelshackLinks.forEach(link => {
            if (link.classList.contains('noelshack-embed')) return;
            try {
                const url = new URL(link.href);
                if (
                    url.protocol === "https:" &&
                    url.hostname === "image.noelshack.com"
                ) {
                    // Accepte tout lien image.noelshack.com qui finit par une extension d'image
                    if (url.pathname.match(/\.(png|jpg|jpeg|gif|webp)$/i)) {
                        const img = document.createElement('img');
                        img.src = link.href;
                        img.alt = 'Noelshack';
                        img.style.maxWidth = '200px';
                        img.style.maxHeight = '200px';
                        img.style.verticalAlign = 'middle';
                        img.className = 'noelshack-embed';
                        link.parentNode.replaceChild(img, link);
                    }
                }
            } catch (e) {}
        });
    }

    // --- Masquage des utilisateurs en train d'écrire et blacklistés ---
    function hideBlacklistedTypingUsers() {
        // Cible les pseudos dans la barre d'utilisateurs (exemple fourni)
        document.querySelectorAll('.row-center.gap-1').forEach(row => {
            const pseudoSpan = row.querySelector('span');
            if (pseudoSpan) {
                const pseudo = pseudoSpan.textContent.trim().toLowerCase();
                if (blacklist.includes(pseudo)) {
                    // Remonte au conteneur principal pour masquer toute la ligne
                    const flexParent = row.closest('span.flex.justify-center');
                    if (flexParent) {
                        flexParent.style.display = 'none';
                    }
                }
            }
                });
            }
        })();

// Ajoute DOMPurify si absent (CDN)
if (typeof DOMPurify === 'undefined') {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/dompurify@3.0.8/dist/purify.min.js';
    script.async = false;
    document.head.appendChild(script);
}

// --- Utilitaire pour insérer du HTML nettoyé ---
function setSafeInnerHTML(element, html) {
    if (window.DOMPurify) {
        element.innerHTML = DOMPurify.sanitize(html);
    } else {
        // Fallback si DOMPurify n'est pas encore chargé
        element.innerHTML = html;
    }
}

// --- Exemple d'intégration dans updateBlacklistPanelContent ---
function updateBlacklistPanelContent(panel) {
    setSafeInnerHTML(panel, `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
            <strong>Blacklist</strong>
            <div>
                <button id="blacklist-export-btn" style="background: none; border: none; color: #4CAF50; cursor: pointer; margin-right: 5px;">⤓ Exporter</button>
                <button id="blacklist-import-btn" style="background: none; border: none; color: #2196F3; cursor: pointer;">⤒ Importer</button>
            </div>
        </div>
    `);
    if (blacklist.length === 0) {
        panel.innerHTML += '<p><em>Aucun utilisateur blacklisté.</em></p>';
    } else {
        const list = document.createElement('div');
        list.style.marginTop = '10px';
        blacklist.slice().sort().forEach(name => {
            const row = document.createElement('div');
            row.style.display = 'flex';
            row.style.justifyContent = 'space-between';
            row.style.alignItems = 'center';
            row.style.padding = '8px 10px';
            row.style.margin = '5px 0';
            row.style.backgroundColor = '#1a1a1a';
            row.style.borderRadius = '8px';
            row.style.borderLeft = '3px solid #ff6b6b';
            const span = document.createElement('span');
            span.textContent = name;
            span.style.fontSize = '14px';
            span.style.color = '#ffffff';
            const del = document.createElement('button');
            del.innerHTML = '❌';
            del.style.background = 'none';
            del.style.color = '#ff6b6b';
            del.style.border = 'none';
            del.style.cursor = 'pointer';
            del.style.fontSize = '16px';
            del.onclick = () => removeFromBlacklist(name);
            row.appendChild(span);
            row.appendChild(del);
            list.appendChild(row);
        });
        panel.appendChild(list);
    }
    // Ajout manuel
    const addForm = document.createElement('div');
    addForm.style.marginTop = '15px';
    addForm.innerHTML = `
        <div style="display: flex; gap: 5px; margin-bottom: 10px;">
            <input type="text" id="blacklist-add-input" placeholder="Nom à blacklister"
                   style="padding: 5px; border-radius: 4px; border: 1px solid #444; background: #222; color: white; flex-grow: 1;">
            <button id="blacklist-add-btn" style="padding: 2px 6px; font-size:12px; background: #4CAF50; color: white; border: none; border-radius: 4px;">Ajouter</button>
        </div>
    `;
    panel.appendChild(addForm);

    // Option confirmation
    const disableConfirmationLabel = document.createElement('div');
    disableConfirmationLabel.style.marginTop = '10px';
    disableConfirmationLabel.innerHTML = `
        <label style="display: flex; align-items: center; gap: 5px; color: white; margin-bottom: 10px;">
            <input type="checkbox" id="disable-confirmation" ${disableConfirmation ? 'checked' : ''}>
            <span>Désactiver la confirmation</span>
        </label>
    `;
    panel.appendChild(disableConfirmationLabel);

    // --- Ajout de la case à cocher pour changer l'icône du bouton blacklist ---
    const iconCheckboxDiv = document.createElement('div');
    iconCheckboxDiv.style.marginTop = '10px';
    iconCheckboxDiv.innerHTML = `
        <label style="display: flex; align-items: center; gap: 5px; color: white;">
            <input type="checkbox" id="blacklist-icon-checkbox">
            <span>Icône blacklist : ❌ au lieu de 🚫</span>
        </label>
    `;
    panel.appendChild(iconCheckboxDiv);

    // Récupérer l'état de l'icône depuis localStorage
    let useCrossIcon = localStorage.getItem('blacklistUseCrossIcon') === '1';
    iconCheckboxDiv.querySelector('#blacklist-icon-checkbox').checked = useCrossIcon;

    // Gestion du changement d'icône
    iconCheckboxDiv.querySelector('#blacklist-icon-checkbox').onchange = (e) => {
        useCrossIcon = e.target.checked;
        localStorage.setItem('blacklistUseCrossIcon', useCrossIcon ? '1' : '0');
        refreshAll(true);
    };

    // Après le checkbox pour l'icône, ajouter le slider
    const sliderDiv = document.createElement('div');
    sliderDiv.style.marginTop = '10px';
    const savedLeft = parseInt(localStorage.getItem('blacklistBtnLeftVillageCX') || '10', 10);
    sliderDiv.innerHTML = `
        <label style="color:white;display:flex;align-items:center;gap:8px;">
            <span>Position du bouton :</span>
            <input type="range" id="blacklist-btn-slider" min="0" max="500" value="${savedLeft}" style="flex:1;">
            <span id="blacklist-btn-slider-value">${savedLeft}px</span>
        </label>
    `;
    panel.appendChild(sliderDiv);

    // Gestion du slider
    const slider = sliderDiv.querySelector('#blacklist-btn-slider');
    const sliderValue = sliderDiv.querySelector('#blacklist-btn-slider-value');
    slider.oninput = (e) => {
        const val = parseInt(e.target.value, 10);
        sliderValue.textContent = val + "px";
        const btn = document.getElementById('options-btn');
        if (btn) btn.style.left = val + "px";
        localStorage.setItem('blacklistBtnLeftVillageCX', val);
    };

    addForm.querySelector('#blacklist-add-btn').onclick = () => {
        const input = addForm.querySelector('#blacklist-add-input');
        const name = input.value.trim();
        if (name) {
            addToBlacklist(name);
            input.value = '';
        }
    };
    addForm.querySelector('#blacklist-add-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const input = addForm.querySelector('#blacklist-add-input');
            const name = input.value.trim();
            if (name) {
                addToBlacklist(name);
                input.value = '';
            }
        }
    });
    panel.querySelector('#disable-confirmation').onchange = (e) => {
        disableConfirmation = e.target.checked;
        saveConfirmationSetting();
    };
    panel.querySelector('#blacklist-export-btn').onclick = exportBlacklist;
    panel.querySelector('#blacklist-import-btn').onclick = importBlacklist;
}
// --- Exemple d'intégration dans updateHighlightListPanelContent ---
function updateHighlightListPanelContent(panel) {
    setSafeInnerHTML(panel, '<strong>Membres en évidence :</strong><br/>');
    if (highlightList.length === 0) {
        panel.innerHTML += '<p><em>Aucun membre en évidence.</em></p>';
    } else {
        const list = document.createElement('div');
        list.style.marginTop = '10px';
        highlightList.forEach(name => {
            const row = document.createElement('div');
            row.style.display = 'flex';
            row.style.justifyContent = 'space-between';
            row.style.alignItems = 'center';
            row.style.padding = '10px';
            row.style.margin = '5px 0';
            row.style.backgroundColor = '#1a1a1a';
            row.style.borderRadius = '8px';
            row.style.borderLeft = '3px solid #FFD700';
            const span = document.createElement('span');
            span.textContent = name;
            span.style.fontSize = '14px';
            span.style.color = '#ffffff';
            const del = document.createElement('button');
            del.innerHTML = '❌';
            del.style.background = 'none';
            del.style.color = '#FFD700';
            del.style.border = 'none';
            del.style.cursor = 'pointer';
            del.style.fontSize = '16px';
            del.onclick = () => removeFromHighlightList(name);
            row.appendChild(span);
            row.appendChild(del);
            list.appendChild(row);
        });
        panel.appendChild(list);
    }
}
function updateHighlightListPanel() {
    const panel = document.getElementById('highlight-panel');
    if (panel) updateHighlightListPanelContent(panel);
}

// Utilitaire pour obtenir un paramètre d'URL (si besoin pour une redirection)
function getParameterByName(name, url = window.location.href) {
    name = name.replace(/[[]]/g, '\\$&');
    const regex = new RegExp('[?&]' + name + '(=([^&#]*)|&|#|$)');
    const results = regex.exec(url);
    if (!results) return null;
    if (!results[2]) return '';
    return decodeURIComponent(results[2].replace(/\+/g, ' '));
}

// Exemple d'utilisation sécurisée pour une redirection
function safeRedirect() {
    const redirectUrl = getParameterByName('redirect');
    if (!redirectUrl) return; // Pas de redirection demandée

    try {
        // On autorise uniquement les URLs internes (même origine)
        const url = new URL(redirectUrl, window.location.origin);
        if (url.origin === window.location.origin) {
            window.location.href = url.href;
        } else {
            // Redirection externe refusée, on reste sur la page ou on redirige vers la racine
            window.location.href = '/';
        }
    } catch (e) {
        // URL invalide, on reste sur la page ou on redirige vers la racine
        window.location.href = '/';
    }
}

// --- Utilitaire pour valider et nettoyer les entrées utilisateur ---
function validateAndSanitizeUsername(input) {
    if (typeof input !== 'string') return null;

    // Nettoie les espaces en début/fin
    input = input.trim();

    // Vérifie que ce n'est pas vide
    if (input.length === 0) return null;

    // Vérifie la longueur (max 50 caractères par exemple)
    if (input.length > 50) return null;

    // Autorise uniquement les caractères alphanumériques, tirets, underscores et espaces
    // Refuse les caractères HTML/JS dangereux
    const allowedPattern = /^[a-zA-Z0-9\s_-]+$/;
    if (!allowedPattern.test(input)) return null;

    // Refuse les mots dangereux (optionnel)
    const dangerousKeywords = ['<script', '</script', 'javascript:', 'data:', 'vbscript:', 'onload', 'onerror'];
    const lowerInput = input.toLowerCase();
    for (const keyword of dangerousKeywords) {
        if (lowerInput.includes(keyword)) return null;
    }

    return input.toLowerCase(); // Retourne en minuscules pour cohérence
}

// --- Stockage Silent Typing ---
let silentTypingEnabled = localStorage.getItem('silentTypingEnabled') === 'true';
    
function toggleSilentTyping() {
    silentTypingEnabled = !silentTypingEnabled;
    localStorage.setItem('silentTypingEnabled', silentTypingEnabled);
    if (silentTypingEnabled) {
        enableSilentTypingWebSocket();
    }
    refreshAll(true);
}

function enableSilentTypingWebSocket() {
    const ws = new WebSocket('wss://village.cx/ws');
    ws.addEventListener('message', (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'typing') {
            // On bloque l'envoi du "is typing"
            event.stopImmediatePropagation();
        }
    });
}

// --- Export/Import Blacklist ---
function exportBlacklist() {
    const data = JSON.stringify(blacklist);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'blacklist.json';
    a.click();
    URL.revokeObjectURL(url);
}

function importBlacklist() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
        const file = e.target.files[0];
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const importedData = JSON.parse(event.target.result);
                if (Array.isArray(importedData)) {
                    blacklist = importedData.map(name => name.toLowerCase());
                    saveBlacklist();
                    refreshAll(true);
                    showNotification('Blacklist importée avec succès');
                }
            } catch (err) {
                showNotification('Erreur lors de l\'import', true);
            }
        };
        reader.readAsText(file);
    };
    input.click();
}
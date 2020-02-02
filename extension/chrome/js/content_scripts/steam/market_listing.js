function addPhasesIndicator(){
    if (/Doppler/.test(window.location.href)) {
        document.querySelectorAll('.market_listing_item_img_container').forEach(container =>{
            container.insertAdjacentHTML('beforeend', dopplerPhase);
            let phase = getDopplerInfo(container.querySelector('img').getAttribute('src').split('economy/image/')[1].split('/')[0]);
            let dopplerElement = container.querySelector('.dopplerPhaseMarket');

            switch (phase.short){
                case dopplerPhases.sh.short: dopplerElement.insertAdjacentHTML('beforeend', sapphire); break;
                case dopplerPhases.rb.short: dopplerElement.insertAdjacentHTML('beforeend', ruby); break;
                case dopplerPhases.em.short: dopplerElement.insertAdjacentHTML('beforeend', emerald); break;
                case dopplerPhases.bp.short: dopplerElement.insertAdjacentHTML('beforeend', blackPearl); break;
                default: dopplerElement.querySelector('span').innerText = phase.short;
            }
        });
    }
}

function addStickers() {
    // removes sih sticker info
    document.querySelectorAll('.sih-images').forEach(image => {image.remove()});

    const listings = getListings();
    const listingsSection = document.getElementById('searchResultsRows');

    if (listingsSection !== null) { // so it does not throw any errors when it can't find it on commodity items
        listingsSection.querySelectorAll('.market_listing_row.market_recent_listing_row').forEach(listing_row => {
            if (listing_row.parentNode.id !== 'tabContentsMyActiveMarketListingsRows' && listing_row.parentNode.parentNode.id !== 'tabContentsMyListings'){
                const listingID = getListingIDFromElement(listing_row);

                if (listing_row.querySelector('.stickerHolderMarket') === null) { // if stickers elements not added already
                    listing_row.querySelector('.market_listing_item_name_block').insertAdjacentHTML('beforeend', `<div class="stickerHolderMarket" id="stickerHolder_${listingID}"></div>`);
                    const stickers = listings[listingID].asset.stickers;

                    stickers.forEach(stickerInfo =>{
                        listing_row.querySelector('.stickerHolderMarket').insertAdjacentHTML('beforeend', `<span class="stickerSlotMarket" data-tooltip-market="${stickerInfo.name}"><a href="${stickerInfo.marketURL}" target="_blank"><img src="${stickerInfo.iconURL}" class="stickerIcon"></a></span>`)
                    });
                }
            }
        });
    }
}

function addListingsToFloatQueue() {
    chrome.storage.local.get('autoFloatMarket', (result) => {
        if (result.autoFloatMarket) {
            if (itemWithInspectLink) {
                let listings = getListings();
                for (let listing in listings) {
                    listing = listings[listing];
                    let assetID = listing.asset.id;

                    floatQueue.jobs.push({
                        type: 'market',
                        assetID: assetID,
                        inspectLink: listing.asset.actions[0].link.replace('%assetid%', assetID),
                        listingID: listing.listingid
                    });

                }
                if (!floatQueue.active) workOnFloatQueue();
            }
        }
    });
}

function addFloatBarSkeletons(){
    chrome.storage.local.get('autoFloatMarket', (result) => {
        if (result.autoFloatMarket) {
            let listingsSection = document.getElementById('searchResultsRows');

            if (listingsSection !== null) { // so it does not throw any errors when it can't find it on commodity items
                let listingNameBlocks = listingsSection.querySelectorAll('.market_listing_item_name_block');
                if (listingNameBlocks !== null && itemWithInspectLink) {
                    listingNameBlocks.forEach(listingNameBlock => {
                        if (listingNameBlock.getAttribute('data-floatBar-added') === null || listingNameBlock.getAttribute('data-floatBar-added') === false) {
                            listingNameBlock.insertAdjacentHTML('beforeend', getFloatBarSkeleton('market'));
                            listingNameBlock.setAttribute('data-floatBar-added', true);

                            // adds "show technical" hide and show logic
                            listingNameBlock.querySelector('.showTechnical').addEventListener('click', event => {
                                event.target.parentNode.querySelector('.floatTechnical').classList.toggle('hidden')
                            });
                        }
                    });
                }
                else setTimeout(() => {
                    addFloatBarSkeletons()
                }, 2000);
            }
        }
    });
}

function populateFloatInfo(listingID, floatInfo){
    let listingElement = getElementByListingID(listingID);

    if (listingElement !== null) { // if for example the user has changed page and the listing is not there anymore
        listingElement.querySelector('.floatTechnical').innerHTML = getDataFilledFloatTechnical(floatInfo);

        const position = ((floatInfo.floatvalue.toFixedNoRounding(2) * 100) - 2).toFixedNoRounding(2);
        listingElement.querySelector('.floatToolTip').setAttribute('style', `left: ${position}%`);
        listingElement.querySelector('.floatDropTarget').innerText = floatInfo.floatvalue.toFixedNoRounding(4);
    }
}

function hideFloatBar(listingID) {
    let listingElement = getElementByListingID(listingID);

    if (listingElement !== null) {
        listingElement.querySelector('.floatBar').classList.add('hidden');
    }
}

function getElementByListingID(listingID){return document.getElementById(`listing_${listingID}`)}

function getListingIDFromElement(listingElement) {return listingElement.id.split('listing_')[1]}


function getListings() {
    const getListingsScript = `
    document.querySelector('body').setAttribute('listingsInfo', JSON.stringify({
        listings: g_rgListingInfo,
        assets: g_rgAssets
    }));`;

    const listingsInfo = JSON.parse(injectToPage(getListingsScript, true, 'getListings', 'listingsInfo'));
    const assets = listingsInfo.assets[730][2];
    const listings = listingsInfo.listings;

    for (const listing in listings){
        const assetID = listings[listing].asset.id;

        for(const asset in assets){
            const stickers = parseStickerInfo(assets[asset].descriptions, 'search');

            if (assetID === assets[asset].id){
                listings[listing].asset = assets[asset];
                listings[listing].asset.stickers = stickers;
            }
        }
    }

    return listings;
}

// sticker wear to sticker icon tooltip
function setStickerInfo(listingID, stickers){
    if (stickers !== null) {
        chrome.storage.local.get(['prices', 'pricingProvider', 'exchangeRate', 'currency'], (result) => {
            const listingElement = getElementByListingID(listingID);

            if (listingElement !== null) {
                stickers.forEach((stickerInfo, index) => {
                    const wear = stickerInfo.wear !== undefined ? Math.trunc(Math.abs(1 - stickerInfo.wear) * 100) : 100;
                    const currentSticker = listingElement.querySelectorAll('.stickerSlotMarket')[index];
                    const stickerPrice = getPrice('Sticker | ' + stickerInfo.name, null, result.prices, result.pricingProvider, result.exchangeRate, result.currency);

                    stickerInfo.price = stickerPrice;
                    currentSticker.setAttribute('data-tooltip-market', `${stickerInfo.name} (${stickerPrice.display}) - Condition: ${wear}%`);
                    currentSticker.querySelector('img').setAttribute('style', `opacity: ${(wear > 10) ? wear / 100 : (wear / 100) + 0.1}`);
                });

                const stickersTotalPrice = getStickerPriceTotal(stickers, result.currency);
                listingElement.setAttribute('data-sticker-price', stickersTotalPrice === null ? '0.0' : stickersTotalPrice.price.toString());
            }
        });
    }
}

function sortListings(sortingMode) {
    let listingElements = [...document.getElementById('searchResultsTable').querySelectorAll('.market_listing_row.market_recent_listing_row')];
    let listingsData = getListings();
    let sortedElements = [];

    if (sortingMode === 'price_asc') {
        sortedElements = listingElements.sort((a, b) => {
            let priceOfA = parseInt(listingsData[getListingIDFromElement(a)].converted_price);
            let priceOfB = parseInt(listingsData[getListingIDFromElement(b)].converted_price);
            return priceOfA - priceOfB;
        });
    }
    else if (sortingMode === 'price_desc') {
        sortedElements = listingElements.sort((a, b) => {
            let priceOfA = parseInt(listingsData[getListingIDFromElement(a)].converted_price);
            let priceOfB = parseInt(listingsData[getListingIDFromElement(b)].converted_price);
            return priceOfB - priceOfA;
        });
    }
    else if (sortingMode === 'float_asc') {
        sortedElements = listingElements.sort((a, b) => {
            let floatOfA = parseFloat(a.querySelector('.floatDropTarget').innerText);
            let floatOfB = parseFloat(b.querySelector('.floatDropTarget').innerText);
            return floatOfA - floatOfB;
        });
    }
    else if (sortingMode === 'float_desc') {
        sortedElements = listingElements.sort((a, b) => {
            let floatOfA = parseFloat(a.querySelector('.floatDropTarget').innerText);
            let floatOfB = parseFloat(b.querySelector('.floatDropTarget').innerText);
            return floatOfB - floatOfA;
        });
    }
    else if (sortingMode === 'sticker_price_asc') {
        sortedElements = listingElements.sort((a, b) => {
            const stickerPriceOfA = a.getAttribute('data-sticker-price') !== 'null' && a.getAttribute('data-sticker-price') !== undefined
                ? parseFloat(a.getAttribute('data-sticker-price'))
                : 0.0;
            const stickerPriceOfB = b.getAttribute('data-sticker-price') !== 'null' && b.getAttribute('data-sticker-price') !== undefined
                ? parseFloat(b.getAttribute('data-sticker-price'))
                : 0.0;
            return stickerPriceOfA - stickerPriceOfB;
        });
    }
    else if (sortingMode === 'sticker_price_desc') {
        sortedElements = listingElements.sort((a, b) => {
            const stickerPriceOfA = a.getAttribute('data-sticker-price') !== 'null' && a.getAttribute('data-sticker-price') !== undefined
                ? parseFloat(a.getAttribute('data-sticker-price'))
                : 0.0;
            const stickerPriceOfB = b.getAttribute('data-sticker-price') !== 'null' && b.getAttribute('data-sticker-price') !== undefined
                ? parseFloat(b.getAttribute('data-sticker-price'))
                : 0.0;
            return stickerPriceOfB - stickerPriceOfA;
        });
    }

    // remove all listings from page
    listingElements.forEach(listingElement => {listingElement.remove()});

    let listingsContainer = document.getElementById('searchResultsRows');
    sortedElements.forEach(listingElement => {
        listingsContainer.insertAdjacentElement('beforeend', listingElement);
    });
}

function addPricesInOtherCurrencies() {
    chrome.storage.local.get('marketOriginalPrice', (result) => {
        if (result.marketOriginalPrice){

            let listings = getListings();
            let listingsSection = document.getElementById('searchResultsRows');

            if (listingsSection !== null) { // so it does not throw any errors when it can't find it on commodity items
                listingsSection.querySelectorAll('.market_listing_row.market_recent_listing_row').forEach(listing_row => {
                    if (listing_row.parentNode.id !== 'tabContentsMyActiveMarketListingsRows' && listing_row.parentNode.parentNode.id !== 'tabContentsMyListings'){
                        let listingID = getListingIDFromElement(listing_row);
                        if (listing_row.querySelector('.originalPrice') === null) { // if stickers elements not added already
                            let price = parseInt(listings[listingID].price);
                            let priceWithFees = price + parseInt(listings[listingID].fee);
                            let currencyID = parseInt(listings[listingID].currencyid) - 2000;
                            listing_row.querySelector('.market_table_value').insertAdjacentHTML('beforeend',
                                `<div class="originalPrice" data-currency-id="${currencyID}">
                                    <div class="market_listing_price_original_after_fees">${priceWithFees}</div>
                                    <div class="market_listing_price_original_before_fees">${price}</div>
                                </div>`);
                        }
                    }
                });

                let currencyConverterScript = `
                    document.getElementById('searchResultsRows').querySelectorAll('.market_listing_row.market_recent_listing_row').forEach(listing_row => {
                        let currencyCode = GetCurrencyCode(parseInt(listing_row.querySelector('.originalPrice').getAttribute('data-currency-id')));
                        let priceWithoutFeesElement = listing_row.querySelector('.market_listing_price_original_before_fees');
                        let priceWithoutFees = parseInt(priceWithoutFeesElement.innerText);
                        priceWithoutFeesElement.innerText = v_currencyformat(priceWithoutFees, currencyCode);
                        let priceWithFeesElement = listing_row.querySelector('.market_listing_price_original_after_fees');
                        let priceWithFee = parseInt(priceWithFeesElement.innerText);
                        priceWithFeesElement.innerText = v_currencyformat(priceWithFee, currencyCode);
                    });`;

                injectToPage(currencyConverterScript, true, 'currencyConverter', false);
            }
        }
    });
}

function addPatterns(listingID, floatInfo) {
    let patternInfo = getPattern(fullName, floatInfo.paintseed);
    if (patternInfo !== null) {
        let listingElement = getElementByListingID(listingID);
        if (listingElement !== null) {
            let patternClass = patternInfo.type === 'marble_fade' ? 'marbleFadeGradient' : 'fadeGradient';
            listingElement.querySelector('.market_listing_item_name').insertAdjacentHTML('afterend', `<span class="${patternClass}"> ${patternInfo.value}</span>`)
        }
    }
}

logExtensionPresence();
updateLoggedInUserID();
trackEvent({
    type: 'pageview',
    action: 'ListingView'
});

const inBrowserInspectButtonPopupLink = `<a class="popup_menu_item" id="inbrowser_inspect" href="http://csgo.gallery/" target="_blank">${chrome.i18n.getMessage("inspect_in_browser")}</a>`;
const dopplerPhase = '<div class="dopplerPhaseMarket"><span></span></div>';

// it takes the visible descriptors and checks if the collection includes souvenirs
let textOfDescriptors = '';
document.querySelectorAll('.descriptor').forEach(descriptor => {textOfDescriptors += descriptor.innerText});
let thereSouvenirForThisItem =  souvenirExists(textOfDescriptors);

let genericMarketLink = 'https://steamcommunity.com/market/listings/730/';
let weaponName = '';
const fullName = decodeURIComponent(window.location.href).split("listings/730/")[1];
let stattrak = 'StatTrak%E2%84%A2%20';
let stattrakPretty = 'StatTrak™';
let souvenir = 'Souvenir ';
let star = '';
let isStattrak = /StatTrak™/.test(fullName);
let isSouvenir = /Souvenir/.test(fullName);

if(/★/.test(fullName)){star = '%E2%98%85%20'}
if(isStattrak) weaponName = fullName.split('StatTrak™ ')[1].split('(')[0];
else if(isSouvenir) weaponName = fullName.split('Souvenir ')[1].split('(')[0];
else{
    weaponName = fullName.split('(')[0].split('★ ')[1];
    if(weaponName === undefined) weaponName = fullName.split('(')[0];
}

let stOrSv = stattrakPretty;
let stOrSvClass = 'stattrakOrange';
let linkMidPart = star + stattrak;
if(isSouvenir || thereSouvenirForThisItem){
    stOrSvClass = 'souvenirYellow';
    stOrSv = souvenir;
    linkMidPart = souvenir;
}

let otherExteriors = `
            <div class="descriptor otherExteriors">
                <span>${chrome.i18n.getMessage("links_to_other_exteriors")}:</span>
                <ul>
                    <li><a href="${genericMarketLink + star + weaponName + "%28Factory%20New%29"}" target="_blank">${exteriors.factory_new.localized_name}</a> - <a href="${genericMarketLink + linkMidPart + weaponName}%28Factory%20New%29" target="_blank"><span class="${stOrSvClass} exteriorsLink">${stOrSv} ${exteriors.factory_new.localized_name}</span></a></li>
                    <li><a href="${genericMarketLink + star + weaponName + "%28Minimal%20Wear%29"}"" target="_blank">${exteriors.minimal_wear.localized_name}</a> - <a href="${genericMarketLink + linkMidPart + weaponName}%28Minimal%20Wear%29" target="_blank"><span class="${stOrSvClass} exteriorsLink">${stOrSv} ${exteriors.minimal_wear.localized_name}</span></a></li>
                    <li><a href="${genericMarketLink + star + weaponName + "%28Field-Tested%29"}"" target="_blank">${exteriors.field_tested.localized_name}</a> - <a href="${genericMarketLink + linkMidPart + weaponName}%28Field-Tested%29" target="_blank"><span class="${stOrSvClass} exteriorsLink">${stOrSv} ${exteriors.field_tested.localized_name}</span></a></li>
                    <li><a href="${genericMarketLink + star + weaponName + "%28Well-Worn%29"}"" target="_blank">${exteriors.well_worn.localized_name}</a> - <a href="${genericMarketLink + linkMidPart + weaponName}%28Well-Worn%29" target="_blank"><span class="${stOrSvClass} exteriorsLink">${stOrSv} ${exteriors.well_worn.localized_name}</span></a></li>
                    <li><a href="${genericMarketLink + star + weaponName + "%28Battle-Scarred%29"}"" target="_blank">${exteriors.battle_scarred.localized_name}</a> - <a href="${genericMarketLink + linkMidPart + weaponName}%28Battle-Scarred%29" target="_blank"><span class="${stOrSvClass} exteriorsLink">${stOrSv} ${exteriors.battle_scarred.localized_name}</span></a></li>
                </ul>
                <span>${chrome.i18n.getMessage("not_every_available")}</span>
            </div>
            `;

const descriptor = document.getElementById('largeiteminfo_item_descriptors');
if(fullName.split('(')[1] !== undefined && descriptor !== null) descriptor.insertAdjacentHTML('beforeend', otherExteriors);

// adds the in-browser inspect button to the top of the page
const originalInspectButton = document.getElementById('largeiteminfo_item_actions').querySelector('.btn_small.btn_grey_white_innerfade'); // some items don't have inspect buttons (like cases)
let itemWithInspectLink = false;
if (originalInspectButton !== null){
    itemWithInspectLink = true;
    const inspectLink = originalInspectButton.getAttribute('href');
    const inBrowserInspectButton =`<a class="btn_small btn_grey_white_innerfade" id="inbrowser_inspect_button" href="http://csgo.gallery/${inspectLink}" target="_blank"><span>${chrome.i18n.getMessage("inspect_in_browser")}</span></a>`;
    document.getElementById('largeiteminfo_item_actions').insertAdjacentHTML('beforeend', inBrowserInspectButton);
    document.getElementById('inbrowser_inspect_button').addEventListener('click', () => {
        // analytics
        trackEvent({
            type: 'event',
            action: 'MarketInspection'
        });
    })
}

// adds the in-browser inspect button to the context menu
document.getElementById('market_action_popup_itemactions').insertAdjacentHTML('afterend', inBrowserInspectButtonPopupLink);

// adds the proper link to the context menu before it gets clicked - needed because the context menu resets when clicked
document.getElementById('inbrowser_inspect').addEventListener('mouseenter', (event)=>{
    let inspectLink = document.getElementById('market_action_popup_itemactions').querySelector('a.popup_menu_item').getAttribute('href');
    event.target.setAttribute('href', `http://csgo.gallery/${inspectLink}`);
});

document.getElementById('inbrowser_inspect').addEventListener('click', () => {
    // analytics
    trackEvent({
        type: 'event',
        action: 'MarketInspection'
    });
});

// adds sorting menu to market pages with individual listings
let searchBar = document.querySelector('.market_listing_filter_contents');
if (searchBar !== null) {
    searchBar.insertAdjacentHTML('beforeend', `
                                                            <div class="market_sorting">
                                                                <span class="market_listing_filter_searchhint">Sort on page by:</span>
                                                                <select id="sortSelect">
                                                                    <option value="price_asc">Cheapest to most expensive</option>
                                                                    <option value="price_desc">Most expensive to cheapest</option>
                                                                    <option value="float_asc">Float lowest to highest</option>
                                                                    <option value="float_desc">Float highest to lowest</option>
                                                                    <option value="sticker_price_asc">Sticker price cheapest to most expensive</option>
                                                                    <option value="sticker_price_desc">Sticker price most expensive to cheapest</option>
                                                                </select>
                                                            </div>`);

    document.getElementById('sortSelect').addEventListener('change', (event) =>{
        sortListings(event.target.options[event.target.selectedIndex].value);
    });
}

addFloatBarSkeletons();
addPhasesIndicator();
addStickers();
addListingsToFloatQueue();
addPricesInOtherCurrencies();



let observer = new MutationObserver((mutations) =>{
    for(let mutation of mutations) {
        if (mutation.target.id === 'searchResultsRows') {
            addPhasesIndicator();
            addFloatBarSkeletons();
            addStickers();
            addListingsToFloatQueue();
            addPricesInOtherCurrencies();
        }
    }
});

let searchResultsRows = document.getElementById('searchResultsRows');
if (searchResultsRows !== null){
    observer.observe(searchResultsRows, {
        subtree: true,
        attributes: false,
        childList: true
    });
}

chrome.storage.local.get('numberOfListings', (result) =>{
    if (result.numberOfListings !== 10){
        let loadMoreMarketAssets = `g_oSearchResults.m_cPageSize = ${result.numberOfListings}; g_oSearchResults.GoToPage(0, true);`;
        injectToPage(loadMoreMarketAssets, true, 'loadMoreMarketAssets', null);
    }
});

// reloads the page on extension update/reload/uninstall
chrome.runtime.connect().onDisconnect.addListener(() =>{location.reload()});

'use strict';
(() => {
  const root = document.querySelector('[data-sample-showcase], [data-full-gallery]');
  if (!root) return;
  const fullGallery = root.hasAttribute('data-full-gallery');
  const assetBase = new URL('gallery/', document.currentScript.src);
  const grid = root.querySelector('[data-sample-grid]');
  const status = root.querySelector('[data-sample-status]');
  const tabs = [...root.querySelectorAll('[data-sample-category]')];
  const canHover = window.matchMedia('(hover: hover) and (pointer: fine)');
  let collections, currentCollection, currentSamples = [], visibleCount = 0;
  let currentCategory, viewerIndex = 0, opener, hoverTimer;
  let currentView = 'both';
  const url = path => new URL(path, assetBase).href;
  const viewSettings = settings => (settings || '').replace(/K=(\d+)/, (_, k) =>
    currentView === 'baseline' ? 'K=0' : currentView === 'both' ? `K=0 / K=${k}` : `K=${k}`);
  function updateSettings() {
    if (!currentCollection) return;
    const settings = root.querySelector('[data-sample-settings]');
    if (!settings) return;
    const selectedSettings = [...new Set(currentSamples.map(sample => sample.settings || currentCollection.settings))];
    const text = fullGallery ? currentCollection.settings
      : selectedSettings.length === 1 ? selectedSettings[0] : 'Selected recorded generations';
    settings.textContent = viewSettings(text);
  }
  function makeViewControls() {
    const controls = document.createElement('div');
    controls.className = 'sample-view-controls';
    controls.setAttribute('role', 'group');
    controls.setAttribute('aria-label', 'Images to display');
    for (const [mode, label] of [['baseline', 'Baseline only'], ['correction', 'Correction only'], ['both', 'Both']]) {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.sampleViewControl = mode;
      button.textContent = label;
      button.addEventListener('click', () => selectView(mode, true));
      controls.append(button);
    }
    return controls;
  }
  grid.before(makeViewControls());
  const correctionLabel = sample => `Correction (${(sample.settings || currentCollection.settings).match(/K=\d+/)?.[0] || ''})`;
  function makePair(sample, thumbnails = false) {
    const pair = document.createElement('span');
    pair.className = 'sample-pair';
    const label = sample.label || sample.prompt || currentCollection.label;
    for (const [title, path] of [
      ['Baseline (K=0)', thumbnails ? sample.baselineThumb : sample.baselineImage],
      [correctionLabel(sample), thumbnails ? sample.thumb : sample.image]
    ]) {
      const column = document.createElement('span');
      column.className = 'sample-pair-column';
      const heading = document.createElement('span');
      heading.className = 'sample-pair-heading';
      heading.textContent = title;
      if (!path) {
        const pending = document.createElement('span');
        pending.className = 'sample-pair-pending';
        pending.textContent = 'Preparing baseline…';
        column.append(heading, pending);
        pair.append(column);
        continue;
      }
      const image = document.createElement('img');
      image.src = url(path);
      image.alt = `${title}: ${label}`;
      image.width = image.height = 256;
      image.loading = 'lazy';
      image.decoding = 'async';
      column.append(heading, image);
      pair.append(column);
    }
    return pair;
  }

  const hover = document.createElement('div');
  hover.className = 'sample-hover';
  hover.setAttribute('aria-hidden', 'true');
  const hoverPair = document.createElement('div');
  const hoverCaption = document.createElement('p');
  hover.append(hoverPair, hoverCaption);
  document.body.append(hover);
  const hideHover = () => { clearTimeout(hoverTimer); hover.classList.remove('is-open'); };
  window.addEventListener('scroll', hideHover, {passive: true});
  window.addEventListener('resize', hideHover, {passive: true});
  function showHover(tile, sample) {
    if (!canHover.matches) return;
    clearTimeout(hoverTimer);
    hoverTimer = setTimeout(() => {
      const bounds = tile.getBoundingClientRect();
      const width = Math.min(currentView === 'both' ? 560 : 310, window.innerWidth - 24);
      hover.style.width = `${width}px`;
      const centerX = bounds.left + bounds.width / 2;
      const left = Math.max(8, Math.min(window.innerWidth - width - 8, centerX - width / 2));
      const height = (currentView === 'both' ? width / 2 : width) + 90;
      const top = Math.max(8, Math.min(window.innerHeight - height - 8, bounds.top + bounds.height / 2 - height / 2));
      hover.style.left = `${left}px`;
      hover.style.top = `${top}px`;
      hoverPair.replaceChildren(makePair(sample));
      hoverCaption.textContent = sample.label || sample.prompt || currentCollection.label;
      hover.classList.add('is-open');
    }, 130);
  }

  const viewer = document.createElement('dialog');
  viewer.className = 'sample-viewer';
  viewer.setAttribute('aria-label', 'Sample details');
  viewer.innerHTML = '<div class="sample-viewer-top"><span data-viewer-count></span><button type="button" data-viewer-close aria-label="Close sample">Close ×</button></div><div class="sample-viewer-images" data-viewer-images></div><p class="sample-viewer-caption" data-viewer-caption></p><p class="sample-viewer-metadata" data-viewer-metadata></p><div class="sample-viewer-controls"><button type="button" data-viewer-prev>← Previous</button><span class="sample-viewer-links"><a data-viewer-baseline target="_blank" rel="noopener">Baseline ↗</a><a data-viewer-original target="_blank" rel="noopener">Correction ↗</a></span><button type="button" data-viewer-next>Next →</button></div>';
  document.body.append(viewer);
  viewer.querySelector('.sample-viewer-top').after(makeViewControls());
  function selectView(mode, updateURL = false) {
    currentView = ['baseline', 'correction', 'both'].includes(mode) ? mode : 'both';
    for (const element of [root, hover, viewer]) element.dataset.sampleView = currentView;
    document.querySelectorAll('[data-sample-view-control]').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.sampleViewControl === currentView));
    });
    hideHover();
    const browse = root.querySelector('[data-gallery-browse]');
    if (browse && currentCategory) browse.href = `gallery/?category=${encodeURIComponent(currentCategory)}&view=${currentView}`;
    const count = root.querySelector('[data-sample-count]');
    if (count && currentSamples.length) count.textContent = `${currentSamples.length.toLocaleString()} ${currentView === 'both' ? 'pairs' : 'samples'}`;
    updateSettings();
    if (viewer.open) updateViewer();
    if (fullGallery && updateURL) {
      const location = new URL(window.location.href);
      location.searchParams.set('view', currentView);
      window.history.replaceState(null, '', location);
    }
  }
  selectView(new URL(window.location.href).searchParams.get('view') || 'both');
  const previous = viewer.querySelector('[data-viewer-prev]');
  const next = viewer.querySelector('[data-viewer-next]');
  function updateViewer() {
    const sample = currentSamples[viewerIndex];
    viewer.querySelector('[data-viewer-images]').replaceChildren(makePair(sample));
    viewer.querySelector('[data-viewer-caption]').textContent = sample.label || sample.prompt || currentCollection.label;
    viewer.querySelector('[data-viewer-count]').textContent = `${currentCollection.label} · ${viewerIndex + 1} / ${currentSamples.length}`;
    const parts = [viewSettings(sample.settings || currentCollection.settings)];
    if (sample.seed !== undefined) parts.push(`Seed ${sample.seed}`);
    if (sample.classId !== undefined) parts.push(`Class ${sample.classId}`);
    viewer.querySelector('[data-viewer-metadata]').textContent = parts.filter(Boolean).join(' · ');
    viewer.querySelector('[data-viewer-original]').href = url(sample.image);
    viewer.querySelector('[data-viewer-baseline]').href = url(sample.baselineImage);
    previous.disabled = viewerIndex === 0;
    next.disabled = viewerIndex === currentSamples.length - 1;
  }
  function openViewer(index, tile) {
    hideHover();
    viewerIndex = index;
    opener = tile;
    updateViewer();
    viewer.showModal();
  }
  function openLinkedSample() {
    if (!fullGallery) return;
    const id = new URL(window.location.href).searchParams.get('sample');
    if (!id) return;
    const index = currentSamples.findIndex(sample => sample.id === id);
    if (index < 0) return;
    while (visibleCount <= index) appendSamples();
    const tile = grid.children[index];
    tile.scrollIntoView({block: 'center'});
    openViewer(index, tile);
  }
  viewer.querySelector('[data-viewer-close]').addEventListener('click', () => viewer.close());
  viewer.addEventListener('click', event => { if (event.target === viewer) viewer.close(); });
  viewer.addEventListener('close', () => { if (opener?.isConnected) opener.focus(); });
  const moveViewer = delta => {
    viewerIndex = Math.max(0, Math.min(currentSamples.length - 1, viewerIndex + delta));
    updateViewer();
  };
  previous.addEventListener('click', () => moveViewer(-1));
  next.addEventListener('click', () => moveViewer(1));
  viewer.addEventListener('keydown', event => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      moveViewer(event.key === 'ArrowLeft' ? -1 : 1);
    }
  });

  function appendSamples() {
    const batch = fullGallery ? 160 : currentSamples.length;
    const end = Math.min(visibleCount + batch, currentSamples.length);
    const fragment = document.createDocumentFragment();
    for (let index = visibleCount; index < end; index++) {
      const sample = currentSamples[index];
      const tile = document.createElement('button');
      tile.type = 'button';
      tile.className = 'sample-tile';
      const label = sample.label || sample.prompt || currentCollection.label;
      tile.setAttribute('aria-label', `Compare baseline and correction, sample ${index + 1}: ${label}`);
      const caption = document.createElement('span');
      caption.className = 'sample-label';
      caption.textContent = label;
      tile.append(makePair(sample, fullGallery), caption);
      tile.addEventListener('mouseenter', () => showHover(tile, sample));
      tile.addEventListener('mouseleave', hideHover);
      tile.addEventListener('click', () => openViewer(index, tile));
      fragment.append(tile);
    }
    grid.append(fragment);
    visibleCount = end;
    const more = root.querySelector('[data-load-more]');
    if (more) more.hidden = visibleCount === currentSamples.length;
    status.textContent = currentSamples.length ? '' : 'No saved samples in this collection yet.';
  }
  function selectCategory(category, updateURL = false) {
    currentCategory = collections[category] ? category : Object.keys(collections)[0];
    currentCollection = collections[currentCategory];
    const selected = new Set(currentCollection.selected || []);
    currentSamples = fullGallery ? currentCollection.samples.filter(sample => !sample.selectedOnly)
      : currentCollection.samples.filter(sample => selected.has(sample.id));
    visibleCount = 0;
    hideHover();
    grid.replaceChildren();
    tabs.forEach(tab => {
      const active = tab.dataset.sampleCategory === currentCategory;
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
    });
    updateSettings();
    const description = root.querySelector('[data-sample-description]');
    if (description) description.textContent = currentCollection.description || '';
    const count = root.querySelector('[data-sample-count]');
    if (count) count.textContent = `${currentSamples.length.toLocaleString()} ${currentView === 'both' ? 'pairs' : 'samples'}`;
    const browse = root.querySelector('[data-gallery-browse]');
    if (browse) {
      browse.href = `gallery/?category=${encodeURIComponent(currentCategory)}&view=${currentView}`;
      const uncuratedCount = currentCollection.samples.filter(sample => !sample.selectedOnly).length;
      browse.textContent = `Uncurated gallery (${uncuratedCount.toLocaleString()}) ↗`;
    }
    const correctionBrowse = root.querySelector('[data-correction-browse]');
    if (correctionBrowse) correctionBrowse.href = `gallery/?category=${encodeURIComponent(currentCategory)}&view=correction`;
    grid.setAttribute('aria-label', currentCollection.label);
    appendSamples();
    if (fullGallery && updateURL) {
      const location = new URL(window.location.href);
      location.searchParams.set('category', currentCategory);
      window.history.replaceState(null, '', location);
    }
  }
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => { if (collections) selectCategory(tab.dataset.sampleCategory, true); });
    tab.addEventListener('keydown', event => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      event.preventDefault();
      const nextIndex = (index + (event.key === 'ArrowLeft' ? -1 : 1) + tabs.length) % tabs.length;
      tabs[nextIndex].focus();
      tabs[nextIndex].click();
    });
  });
  root.querySelector('[data-load-more]')?.addEventListener('click', appendSamples);
  fetch(url('data.json')).then(response => {
    if (!response.ok) throw new Error(`Gallery HTTP ${response.status}`);
    return response.json();
  }).then(data => {
    collections = data.collections;
    selectCategory(new URL(window.location.href).searchParams.get('category') || 'imagenet-conditional');
    openLinkedSample();
    if (fullGallery && 'IntersectionObserver' in window) {
      new IntersectionObserver(entries => {
        if (entries.some(entry => entry.isIntersecting) && visibleCount < currentSamples.length) appendSamples();
      }, {rootMargin: '600px'}).observe(root.querySelector('[data-sample-sentinel]'));
    }
  }).catch(error => {
    console.error(error);
    status.textContent = 'The sample gallery could not load. Please reload the page.';
  });
})();

// The standalone gallery shares the existing production-only site analytics.
(() => {
  const beacon = 'https://static.cloudflareinsights.com/beacon.min.js';
  if (window.location.hostname !== 'correction-training.github.io' || document.querySelector(`script[src="${beacon}"]`)) return;
  const script = document.createElement('script');
  script.type = 'module';
  script.src = beacon;
  script.setAttribute('data-cf-beacon', JSON.stringify({token: 'bcb5d605a56943f49b556b03849d7327'}));
  document.body.appendChild(script);
})();

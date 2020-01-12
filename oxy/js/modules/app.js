export class app {
  async start() {
    await this.loadMold();
    window.onpopstate = e => oxy.app.restoreState(e.state)
    oxy.app.restoreState(history.state);
  }
  
  async loadMold() {
    const p = x => window.oxy.loader.loadStage(x);

    p('app_module_loaded');
    await oxy.tpl;
    p('template_module_loaded');

    await oxy.loader.DOMUpdateTimeslot();
    
    const startTemplate = document.querySelector('script[oxy]').getAttribute('oxy');

    const instance = await oxy.tpl.render(startTemplate);
    p('first_template_loaded');
    
    const node = await instance.render.node;
    p('first_template_rendered');
    
    await oxy.loader.DOMUpdateTimeslot();
    document.getElementById('oxy-default-render-place').appendChild(node);

    // loader.loadStage('done');

    return instance.render.finished;
  }

  async commitState(state, title, url) {
    window.history.pushState(state, state.title || title, url || state.url);
    state.url = location.pathname;
    window.history.replaceState(state, state.title || title, url || state.url);
    this.restoreState(state);
  }

  async rollbackState() {
    window.history.go(-1);
  }

  async replaceState(state, title, url) {
    window.history.replaceState(state, state.title || title, url || state.url);
    state.url = location.pathname;
    window.history.replaceState(state, state.title || title, url || state.url);
  }

  async restoreState(state) {
    if (!await this.displayState)
      return console.log('Skipping state because displayState is undefined', state);

    state.title = (state.title || document.title).trim();
    state.url = (state.url || location.pathname).trim();
    return this.displayState(state, state.title, state.url);
  }

  async reloadState() {
    return this.restoreState(history.state || {})
  }


}
export class app {
  async start() {
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
  }
}
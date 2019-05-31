export class app {
  async start() {
    const startTemplate = document.querySelector('script[oxy]').getAttribute('oxy');

    document.getElementById('oxy-default-render-place').innerHTML = await oxy.tpl.render(startTemplate);
  }
}
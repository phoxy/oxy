class oxy_loader {
  constructor(oxyHolder) {
    this.oxy = oxyHolder;
  }

  rest(url, data, retry = 1) {
    const fetch_params = {};

    if (data) {
      fetch_params.method = 'post';
      fetch_params.body = data;
      fetch_params.headers = {
        'Content-type': 'application/x-www-form-urlencoded',
      };
    }

    try {
      return fetch(url, fetch_params)
        .then((data, reject) => data.ok ? data.text() : reject(data));
    } catch (e) {
      // request failed
      if (data || !retry) // do not retry post
        throw e;

      return rest(url, data, retry - 1);
    }
  }

  async resourseUrl(url) {
    const version = await this.version();
    return `${url}?v=${version}`;
  }

  async fetchResourse(url) {
    return this.rest(await this.resourseUrl(url));
  }

  dom_update_queue;

  DOMUpdateTimeslot() {

    if (!this.dom_update_queue) {
      this.dom_update_queue = [];
      requestAnimationFrame(() => {
        const queue = this.dom_update_queue;
        this.dom_update_queue = undefined;

        const start = new Date();
        queue.map(cb => cb(document))
        const end = new Date();
        console.log('frame', end - start, 'ms', `(${queue.length})`);

      }) 
    }
    
    let resolve;
    const promise = new Promise(r => resolve = r)

    this.dom_update_queue.push(resolve);
    return promise;
  }

  async version() {
    if (typeof this.oxy_version != 'undefined')
      return await this.oxy_version;
    if (window.oxy_version)
      return window.oxy_version;

    for (let storage of ['sessionStorage', 'localStorage'])
      if (window[storage] && window[storage].getItem('oxy_version'))
        return window[storage].getItem('oxy_version');

    try {
      this.oxy_version = this.rest('api/version');

      return this.oxy_version
        .catch(x => this.oxy_version = 0);
    } catch (e) {
      return undefined;
    }
  }

  async injectModule(module) {
    const url = await this.resourseUrl(`/assets/oxy/js/modules/${module}.js`);
    let res = await import(url);

    return this.oxy[module] = new res[module];
  }

  static asyncChain(source_promise) {
    const magicFunction = () => source_promise;

    return new Proxy(magicFunction, {
      get: (t, key) => {
        if (key == 'then')
          return source_promise.then.bind(source_promise);

        const result_promise = source_promise.then(x => x[key])
        //return result_promise;
        return oxy_loader.asyncChain(result_promise);
      }
      ,
      apply: (context, thisArg, argumentsList) => {
        let target = source_promise;


        return target.then(targetFunc =>
          targetFunc.apply(thisArg, argumentsList)
        );
      }
    })
  }

  spinStep() {
    const spins = 4 || document.getElementById('oxy-loading-splash').style.getPropertyValue('--spins');
    const step = 180 / 360 / spins;
    return step;
  }

  async loadStage(name) {
    const stages = {
      loader_starts: 10,
      app_module_loaded: 30,
      template_module_loaded: 40,
      first_template_loaded: 50,
      first_template_rendered: 80,
      done: 100,
    };

    const v = stages[name];
    
    if (!v) return;

    const step = v / 10 * this.spinStep();

    await this.DOMUpdateTimeslot();
    document.body.style.setProperty('--oxy-load-persentage', step * 100);
  };
}

// Develop purposes:
{
  const oxyHolder = {};
  const loader = new oxy_loader(oxyHolder);

  window.oxy = new Proxy(oxyHolder, {
    get: (target, key, value, receiver) => {
      if (target[key])
        return target[key];

      let load_promise = loader.injectModule(key);
      let chain_shortcut = oxy_loader.asyncChain(load_promise);

      return target[key] = chain_shortcut;
    }
  })

  window.oxy.loader = loader;
  loader.oxy_version = "dev";
  loader.loadStage('loader_starts');

  window.oxy.app.start();
}

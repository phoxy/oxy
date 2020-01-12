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
        .then(data => data.ok ? data.text() : Promise.reject(data));
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
    const processQueue = () => {
      const queue = this.dom_update_queue || [];
      this.dom_update_queue = undefined;

      const start = new Date();
      queue.map(cb => cb(document))
      const end = new Date();

      const duration = end - start;

      if (duration > 30)
        console.log('frame', duration, 'ms', `(${queue.length})`);

    };

    if (!this.dom_update_queue) {
      this.dom_update_queue = [];
      requestAnimationFrame(processQueue);
      // process in backgroud as well
      setTimeout(processQueue, 100);
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
    const res = await import(url);

    const obj = new res[module]

    return obj;

    return this.oxy[module] = oxy_loader.asyncChain(Promise.resolve(obj));
  }

  static asyncChain(source_promise) {
    const magicFunction = () => source_promise;

    const state = {
      get: [],
    }

    let resolved = false;
    
    setTimeout(async _ => {
      if (resolved || state.get.length)
        return;

      // If user did not claimed result after function call
      await proxy;
    }, 0);
    

    const asyncAccess = (source, remain) => {
      while (true) {
        const resolved = source;
        if (!remain.length)
          return resolved;

        const key = remain.shift();
        const field = resolved[key];

        source = field;
      }
    };

    const unwrap = () => {
      resolved = true;
      const resolve = source_promise.then(source => asyncAccess(source, state.get))
      return resolve;
    }

    const callPromisedMethod = async (path, args) => {
      const method = state.get.pop();
      const source = await source_promise;
      const getObject = () => asyncAccess(source, [...state.get]);
      let object = getObject();

      // force separate calls
      if (typeof getObject()[method] == 'undefined') {
        // the object is promised and had to be awaited
        object = await object;
      }

      // call method with correct this, and no collision with any field names
      return object[method](...args);
    }

    const proxy = new Proxy(magicFunction, {
      get: (t, key) => {
        if (['catch', 'then'].includes(key)) {
          const resolve = unwrap();
          return resolve[key].bind(resolve);
        }

        state.get.push(key);
        return proxy;
      },
      apply: (a, b, args, d) => {
        const result = callPromisedMethod(state.get, args);

        return oxy_loader.asyncChain(result);
      },
      set: (a, key, value) => {
        const resolve = unwrap();
        return resolve.then(obj => obj[key] = value)
      },
    });

    return proxy;
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

      const load_promise = loader.injectModule(key);
      const chain_shortcut = oxy_loader.asyncChain(load_promise);

      const reshedule_call = new Proxy(load_promise, {
        get: (t, k) => {
          return oxy_loader.asyncChain(load_promise)[k];
        },
        set: (t, k, v) => {
          oxy_loader.asyncChain(load_promise)
            .then(obj => obj[k] = v);
          return v;
        }
      })

      return target[key] = reshedule_call;
    }
  })

  window.oxy.loader = loader;
  loader.oxy_version = "dev";
  loader.loadStage('loader_starts');

  window.oxy.app.start();
}

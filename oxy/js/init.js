class oxy_loader {
  constructor(oxyHolder) {
    this.oxy = oxyHolder;
  }

  rest(url, data) {
    const fetch_params = {};

    if (data) {
      fetch_params.method = 'post';
      fetch_params.body = data;
      fetch_params.headers = {
        'Content-type': 'application/x-www-form-urlencoded',
      };
    }

    return window.fetch(url, fetch_params)
      .then(response => response.text());
  }

  async resourseUrl(url) {
    const version = await this.version();
    return `${url}?v=${version}`;
  }

  async fetchResourse(url) {
    return this.rest(await this.resourseUrl(url));
  }

  DOMUpdateTimeslot() {
    let resolve;
    const promise = new Promise(r => resolve = r)
    requestAnimationFrame(() => resolve(document))
    return promise;
  }

  async version() {
    if (this.oxy_version)
      return await this.oxy_version;
    if (window.oxy_version)
      return window.oxy_version;

    for (let storage of ['sessionStorage', 'localStorage'])
      if (window[storage] && window[storage].getItem('oxy_version'))
        return window[storage].getItem('oxy_version');

    try {
      this.oxy_version = this.rest('api/version');
      return await this.oxy_version;
    } catch (e) {
      return undefined;
    }
  }

  async injectModule(module) {
    const url = await this.resourseUrl(`/assets/oxy/js/modules/${module}.js`);
    let res = await import(url);

    return this.oxy[module] = res;
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

      // dev
      load_promise.then(x => console.log(key, "is loaded"));

      return target[key] = chain_shortcut;
    }
  })

  //window.oxy.app.start();
}

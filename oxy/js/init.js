class oxy_loader {
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

  async fetchResoure(url) {
    const version = await this.version();
    return this.rest(`${url}?v=${version}`);
  }

  async attachOxyScript(url) {
    const script_text = await fetchResoure(url);
    return await eval.call(window.oxy, script_text);
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

  init() {
    const modules = [
      'app',
      'render',
    ];

    const loading = modules
      .map(x => `oxy/${x}`)
      .map(x => this.fetchResoure(x))

    return Promise.all(loading)
  }
}

// Develop purposes:
{
  const loader = new oxy_loader();
  loader.init();
}
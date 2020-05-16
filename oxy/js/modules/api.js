class tet {
    field() {
      return 5;
    }
  }
  
  class apiRequest {
    /* safari sux 
    path = [];
    p;
    proxy;
    */
  
    constructor() {
      this.path = [];

      let r;
      this.p = new Promise(_ => r = _)
  
      //const callback = this.resolve.bind(this, r);
      //setTimeout(callback, 0);
  
      this.proxy = new Proxy(() => {},
          {
            get: (t, key) => {
              if (key == 'then') {
                const p = this.commit()
                return p.then.bind(p);
              }
                
              return this.access(t, key);
            },
  
            apply: (_, _this, _args) => {
              return this.commit(_args);
            }
          })
    }
  
    access(t, key) {
      if (key == 'then')
        return 'test';
        /*
      && this.path.length > 0)
        if (this.path.slice(-1)[0] == 'then') // double then means we in endless promise loop
          return "test";
  */
      this.path.push(key);
  
      return this.proxy
    }
  
    async commit(value) {
      const filterThen = this.path.filter(x => x != 'then');
      const url = filterThen.join('/');
  
      const params = !value
        ? 
        {
          credentials: 'same-origin',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('jwt')}`,
          }
        }
        :
        {
          method: 'POST',
          cache: 'no-cache',
          credentials: 'same-origin',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('jwt')}`,
          },
          body: JSON.stringify(value),
        };
  
      const request = await fetch(`/api/${url}`, params);
      const json = await request.json();
  
      if (json.jwt)
        localStorage.setItem('jwt', json.jwt);
  
      return json;
    }
  
    async resolve(r) {
      const json = await this.commit();
      r(json);
    }
  }
  
  const scheduleNewRequest = (t, key) => {
    if (key == 'then')
      return {};
  
    const request = new apiRequest();
    return request.access(t, key);
  }
  
  export let api = Proxy.bind(Proxy, {},
    { get: scheduleNewRequest })
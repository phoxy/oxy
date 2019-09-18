class template_context {
  buffer = [];
  state;
  childs = [];

  constructor(state, opts, args) {
    this.opts = opts;
    this.state = state;
    this.args = args;
    state.childs = 0;

    this.state.hooks.after.render.node.push(node => {
      this.domCB.map(cb => cb(node))
    })

    this.state.hooks.after.render.node.push(node => {
      if (!this.dollarCB)
        return;

      const root = typeof $ !== 'undefined' ? $(node) : null;
      this.dollarCB.map(cb => cb(root))
    })

    this.state.hooks.after.render.finished.push(async node => {
      if (!this.domResolvedCB.length)
        return;

      const childs = await Promise.all(this.childs);
      const nodes = childs.map(x => x.render.finished);

      await Promise.all(nodes);
      const cb = this.domResolvedCB.map(cb => cb(node))
      await Promise.all(cb);
    });

    this.state.hooks.after.render.finished.push(async _ => {
      const childs = await Promise.all(this.childs);
      const finished = childs.map(x => x.render.finished);
      return Promise.all(finished);
    })
  }

  append(text) {
    //this.dom.insertAdjacentHTML('beforeend', text);
    this.buffer.push(text);
  }

  async html() {
    if (this.html_cache)
      return this.html_cache;

    const resolved = await Promise.all(this.buffer)
    return this.html_cache = resolved.map(String).join(``);
  }

  async node() {
    const html = await this.html();

    var template = document.createElement(`oxytpl-${this.opts.name}`);
    template.innerHTML = html;
    return template;
    
    //.childNodes
    
    const shadowHost = document.createElement(`oxytpl-${this.opts.name}`);
    const shadowRoot = shadowHost.attachShadow({mode: 'open'});
    shadowRoot.innerHTML = html;

    this.dom = shadowHost;
    return shadowHost;
  }

  addTemplate(address, args = {}) {
    if (address[0] != '/') {
      // relative address
      const location = this.opts.address.replace(/^(?:(.*\/)|.*).*$/, '$1');
      address = `${location}${address}`;
    }

    const genTemplId = address => `${this.opts.name}_${address.replace(/[^\w\d]/g, `_`)}_${this.state.childs++}`;
    const id = genTemplId(address);

    const task = oxy.tpl.render(address, args);
    const promise = task.then(x => x.render.finished);

    this.childs.push(task);

    let resolveTarget;
    const target = new Promise(_ => resolveTarget = _)
    
    const resolveChild = Promise.all([promise, target])
      .then(async ([node, target]) => {
        await oxy.loader.DOMUpdateTimeslot();
        target.parentNode.replaceChild(node, target);
        // Align select and update in different frames
      })

    this.state.hooks.after.render.node.push(
      async node => {
        const target = node.querySelector(`#${id}`);
        resolveTarget(target);
        return resolveChild;
      }
    )

    this.append(`<oxytpl id="${id}"></oxytpl>`);
  }

  domCB = [];
  dom(cb) {
    this.domCB.push(cb);
  }

  dollarCB = [];
  dollar(cb) {
    this.dollarCB.push(cb);
  }

  domResolvedCB = [];
  domResolved(cb) {
    this.domResolvedCB.push(cb);
  }

  script(addr) {
    this.state.hooks.before.render.node.push(() => oxy.tpl.require(addr));
  }

  async escapeHTML(x) {
    const dictionary = [
      ['&', '&amp;'],
      ['<', '&lt;'],
      ['>', '&gt;'],
    ];
    const map = Object.fromEntries(dictionary);
    const keys = Object.keys(map);
    const reg = new RegExp(`[${keys.join('')}]`, 'g');

    const str = String(await x);
    return str.replace(reg, ch => map[ch] || ch);
  }
}

class promise_with_hooks extends Promise {
  before = [];
  after = [];
  contructed = false;
  actionPromise;
  actionDoneCb;
  returnPromise;

  init() {
    if (this.contructed)
      return;
/*
    this.actionPromise = new Promise(_ => this.actionDoneCb = _);

    const unwrap = (arr, arg) => arr.map(f => f(arg)); //arr.map(f => Promise.resolve(arg).then(f));

    const p = this.actionPromise
      .then(x => Promise
        .all(unwrap(after, x))
        .then(_ => x)
      )

    let debug;
    const run = (_) => 
      Promise
        .all(debug = unwrap(before, _))
        .then(console.log(debug))
        .then(r(_));
*/
    this.returnPromise = run;
  }

  then() {
    return this.returnPromise
  }


}

class template_instance_state_factory {
  warm_promises = [];
  target = 100;
  baking;

  constructor() {
    this.start_baking();
  }

  start_baking() {
    if (this.baking)
      return;

    const loop = () => {
      this.warp_promise();

      if (this.warm_promises.length < this.target)
        requestIdleCallback(loop);
      else
        this.baking = false;
    }

    loop();
    this.baking = true;
  }

  create_promise() {
    if (this.warm_promises.length < this.target / 2)
      this.start_baking();

    if (this.warm_promises.length)
      return this.warm_promises.pop();

    return this.raw_create_promise();
  }

  warp_promise() {
    this.warm_promises.push(this.raw_create_promise());
  }

  raw_create_promise() {
    const before = [], after = [];

    const unwrap = (arr, arg) => arr.map(f => f(arg)); //arr.map(f => Promise.resolve(arg).then(f));

    let r;
    const p = new Promise(_ => r = _)
      .then(x => Promise
        .all(unwrap(after, x))
        .then(_ => x)
      )

    const run = (_) => 
      Promise
        .all(unwrap(before, _))
        .then(x => r(_));
  

    return [p, run, {before, after}];
  }
}
const states_factory = new template_instance_state_factory();

class template_instance_state {
  constructor() {
    const on = {
      render: {
        start: null,
        buffer: null,
        html: null,
        node: null,
        finished: null,
      },
      dom: {
        attached: null,
      }
    };

    const create_promise = () => {
      return states_factory.create_promise();

      const before = [], after = [];

      const unwrap = (arr, arg) => arr.map(f => Promise.resolve(arg).then(f));

      let r;
      const p = new Promise(_ => r = _)
        .then(x => Promise
          .all(unwrap(after, x))
          .then(_ => x)
        )

      const run = (_) => 
        Promise
          .all(unwrap(before, _))
          .then(r(_));

      return [p, run, {before, after}];
    }

    const recursive = (obj) => {
      const ret = {
        on: {},
        handle: {},
        hooks: {
          before: {},
          after: {},
        }
      };

      for (let k in obj) {
        const v = obj[k];

        let on, handle, hooks = {after: [], before: []};

        if (v !== null) 
          ({on, handle, hooks} = recursive(v));
        else if (typeof v == 'object')
          [on, handle, hooks] = create_promise();

        
        [ret.on[k], ret.handle[k], ret.hooks.before[k], ret.hooks.after[k]] =
          [on, handle, hooks.before, hooks.after];
      }

      return ret;
    }

    const ret = recursive(on);
    this.on = ret.on;
    this.handle = ret.handle;
    this.hooks = ret.hooks;
  }

  run() {
    Promise.all(this.hooks.before.render.start)
      .then(this.handle.render.start())

    return this.on;
  }

  // todo proxy read only access to user state
}

class template_instance {
  state = new template_instance_state();

  constructor(opts, args, functor) {
    const context = this.context(opts, args);
    this.init(context, functor);
  }

  getState() {
    return this.state.on;
  }

  context(opts, args) {
    const context = new template_context(this.state, opts, args);

    return context; // debugging, temporary no proxies

    return new Proxy(context, {
      get: (t, p) => {
        return t[p] || args[p];
      },
      set: (t, p, v) => {
        let receiver = typeof t[p] == 'undefined' ? args : t;
        return receiver[p] = v;
      },
    });
  }


  init(context, functor) {
    const nextTick = (v) => new Promise(_ => setInterval(() => _(v), 0));

    const start = async _ => {
      const last_output = await functor.eval.call(context, context.args);

      if (last_output)
        context.append(last_output);

      this.state.handle.render.buffer(context.buffer)
    }

    this.state.on.render.start
      .then(_ => !start(_))
    

    this.state.on.render.buffer
      .then(_ => context.html())
      .then(_ => !this.state.handle.render.html(_))

    function hashCode(s) {
      let h = 0;
      for(let i = 0; i < s.length; i++) 
        h = Math.imul(31, h) + s.charCodeAt(i) | 0;
    
      return h;
    }

    this.state.on.render.html
      .then((async html => {
        const hash = hashCode(html);
        /*
        if (functor.cache.html != hash)
        {  
          const node = context.node();
          functor.cache.html = hash;
          functor.cache.node = node.then(node => functor.cache.node = node);
        }*/
        //if (functor.cache.html == hash)
          functor.cache.node = context.node(functor.cache.html);

        const node = await functor.cache.node;
        return node; //.cloneNode(true);  
      }))
      .then(_ => !this.state.handle.render.node(_))

    this.state.on.render.node
      .then(_ => !this.state.handle.render.finished(_))

    return this;
  }

  run() {
    return this.state.run();
  }
}

class template_functor {
  cache = {
    html: null,
    node: null,
  };
  
  constructor(opts, code) {
    this.opts = opts;

    const resolveAddr = opts.address.replace(/\/[^\/]+\/\.\./g, "");
    const sourceURL = `${location.origin}/ctpl/${resolveAddr}`.replace(/([^:])\/\//g, "$1/")
    
    const inject =
      [
        `return async function tpl_${opts.name}(args) {`,
        code,
        `}`,
        '//# sourceURL=' + sourceURL + '\n',
      ].join(`\n`);

    this.eval = new Function(inject)();
  }

  instance(args) {
    return new template_instance(this.opts, args, this);
  }
}

export class tpl {
  compile_cache = {};

  sheduleQueue = [];
  rendering = 0;
  limit = 100;

  async renderSlot() {
    if (!this.sheduleQueue.length && this.rendering < this.limit)
      return this.rendering++;

    let trigger;
    const p = new Promise(_ => trigger = () => _(this.rendering++));

    if (this.sheduleQueue.length) {
      this.sheduleQueue.push(trigger);
      return p;
    }

    // CPU overused, shedule on next free timeslot
    this.sheduleQueue.push(trigger);
    const idleLoop = () => {
      const [toProcess, reshedule] = [
        this.sheduleQueue.slice(0, 1000),
        this.sheduleQueue.slice(1000),
      ];

      this.sheduleQueue = reshedule;

      toProcess.map(f => f());

      if (this.sheduleQueue.length)
        requestIdleCallback(idleLoop);
    }

    requestIdleCallback(idleLoop);

    return p;
  }

  async render(address, args) {
    await this.renderSlot();

    const template = await this.getFunctor(address);

    args = await args;
    const instance = template.instance(args || {});

    const handles = instance.run();

    handles.render.node
      .then(() => this.rendering--);

    return handles;
  }

  async getFunctor(address) {
    const name = address.replace(/[^\w\d]/g, `_`);
    if (typeof this.compile_cache[name] == 'undefined') {
      this.compile_cache[name] = Promise.resolve()
        .then(async _ => {
          const code = await oxy.loader.rest(`/tpl/${address}.tpl`);
          const compiled = await this.compile(name, code);
          const template = new template_functor({address, name}, compiled);

          return this.compile_cache[name] = template;
        })
    }
      
    return this.compile_cache[name];
  }

  require(address) {
    const script = document.createElement('script')
    script.type = 'text/javascript';
    script.src = address;
    script.source = name;

    const p = new Promise(_ => script.onload = _);

    oxy.loader.DOMUpdateTimeslot()
      .then(document.body.appendChild(script));

    return p;
  }

  async compile(name, code) {
    const chunks = code.split(`{{`);

    if (chunks.find(x => x.includes(`{{`)))
      throw new Error(`Unexpected '{{' found, '}}' expected.`);

    const echo = x => x == '' ? '' : `this.append(${x})`;

    const echoEscaped = x => echo(`this.escapeHTML(${x})`);

    const css = (css) => {
      const detachedLoad = async () => {
        const isLink = !css.match(/{/);
          let link;
    
          if (!isLink) {
            const blob = new Blob([css], {type: 'text/css'});
            link = URL.createObjectURL(blob);
          }
          else {
            link = await oxy.loader.resourseUrl(css.trim());
          }
    
          const tag = document.createElement('link');
          tag.rel = 'stylesheet';
          tag.href = link;
          tag.source = name;
    
          await oxy.loader.DOMUpdateTimeslot()
          document.body.appendChild(tag);
      }

      detachedLoad();
      echo(`'<!-- css applied -->'`);
    }

    const first = cb => `this.dom(root => {${cb}})`;

    const dollar = cb => `this.dollar(root => {${cb}})`;

    const all = cb => `/* SLOW BY DESIGN */ this.domResolved(root => {${cb}})`;

    const script = link => `this.script('${link}')`

    let required = [];
    const require = link => required.push(link); 
    

    const process = chunk => {
      const modes = {
        // {{ /* regular javascript code */ }}
        ' ': x => x,
        // {{+ /* append cascade template */ }}
        '+': x => ['this.addTemplate(', x, ')'].join(' '),
        // {{< /* echo javascript code result, escaped */ }}
        '<': x => echoEscaped(x),
        // {{= /* echo javascript code result with possible XSS (raw as it is) */}}
        '=': x => echo(x),
        // {{s /* css resource file link or inline (persistent) css code */ }}
        'c': x => css(x),
        // {{d /* callback on when appended on the page */ }}
        // 'd': x => displayed(x),
        // {{: /* when first node is ready */ }}
        ':': x => first(x),
        // {{; /* when all nodes is ready */ }}
        ';': x => all(x), 
        // {{$ /* first node but wrapped with jQuery alike interface */ }}
        '$': x => dollar(x),
        // {{s /* script that expected to be at time of elements appear */ }}
        's': x => script(x),
        // {{r /* script that required for rendering */ }}
        'r': x => require(x),
      };

      let mode = chunk[0];

      if (modes[mode])
        chunk = chunk.substr(1); // first symbol is mode select, skip it
      else
        mode = ' '; // if no mode selected, then use default

      let [insideBrackets, outsideBrackets] = chunk.split(`}}`);

      if (typeof outsideBrackets == 'undefined')
        outsideBrackets = ''; // corner case

      return [
        modes[mode](insideBrackets),
        echo(`\`${outsideBrackets}\``),
      ].join(`;`);
    }

    chunks[0] = `=\`${chunks[0]}\``;
    const compiled = chunks.map(x => process(x));

    await Promise.all(required.map(link => this.require(link)))

    return compiled.join(`\n`);
  }
}
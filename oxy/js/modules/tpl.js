class template_context {
  buffer = [];
  name;
  state;

  constructor(state, name, args) {
    this.name = name;
    this.state = state;
    state.childs = 0;
  }

  append(text) {
    //this.dom.insertAdjacentHTML('beforeend', text);
    this.buffer.push(text);
  }

  async html() {
    const resolved = await Promise.all(this.buffer)
    return resolved.join(`\n`);
  }

  async node() {
    const html = await this.html();
    const shadowHost = document.createElement(`oxytpl-${this.name}`);
    shadowHost.innerHTML = html;

    this.dom = shadowHost;
    return shadowHost;
  }

  addTemplate(address, args = {}) {
    const genTemplId = address => `${this.name}_${address.replace('/', '_')}_${this.state.childs++}`;
    const id = genTemplId(address);

    const task = oxy.tpl.render(address, args);
    const promise = task.then(x => x.render.node);

    this.state.hooks.after.render.node.push(
      async node => {
        const target = node.querySelector(`#${id}`);
        target.insertAdjacentElement("afterEnd", await promise);
        target.parentNode.removeChild(target);
      }
    )

    this.append(`<oxytpl id="${id}"></oxytpl>`);
  }
}

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
      const before = [], after = [];

      const unwrap = (arr, _) => arr.map(x => x(_));

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

  constructor(name, args, functor) {
    const context = this.context(name, args);
    this.init(context, functor);
  }

  getState() {
    return this.state.on;
  }

  context(name, args) {
    const context = new template_context(this.state, name, args);

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
    this.state.on.render.start
      .then(_ => {
        const last_output = functor.eval.call(context);

        if (last_output)
          context.append(last_output);

        return context.buffer
      })
      .then(this.state.handle.render.buffer);

    this.state.on.render.buffer
      .then(x => context.node())
      .then(this.state.handle.render.node);

    return this;
  }

  run() {
    return this.state.run();
  }
}

class template_functor {
  
  constructor(name, code) {
    this.name = name;
    
    const inject =
      [
        `return function tpl_${name}() {`,
        code,
        `}`
      ].join(`\n`);

    this.eval = new Function(inject)();
  }

  instance(args) {
    return new template_instance(this.name, args, this);
  }
}

export class tpl {
  compile_cache = {};

  async render(address, args = {}) {
    const template = await this.getFunctor(address);

    const instance = template.instance(args);

    return instance.run();
  }

  async getFunctor(address) {
    const name = address.replace(/[^\w\d]/g, `_`);
    if (typeof this.compile_cache[name] == 'undefined') {
      this.compile_cache[name] = Promise.resolve()
        .then(async _ => {
          const code = await oxy.loader.rest(`tpl/${address}.tpl`);
          const compiled = await this.compile(code);
          const template = new template_functor(name, compiled);

          return this.compile_cache[name] = template;
        })
    }
      
    return this.compile_cache[name];
  }

  async compile(code) {
    const chunks = code.split(`{{`);

    if (chunks.find(x => x.includes(`{{`)))
      throw new Error(`Unexpected '{{' found, '}}' expected.`);

    const escapeHTML = x => {
      const dictionary = [
        ['&', '&amp;'],
        ['<', '&lt;'],
        ['>', '&gt;'],
      ];
      const map = Object.fromEntries(dictionary);
      const keys = Object.keys(map);
      const reg = new RegExp(`[${keys.join('')}]`, 'g');

      return x.replace(reg, ch => map[ch] || ch);
    }

    const echo = x => x == '' ? '' : `this.append(${x})`;

    const echoEscaped = x => echo(escapeHTML(x));

    const process = chunk => {
      const modes = {
        // {{ /* regular javascript code */ }}
        ' ': x => x,
        // {{+ /* append cascade template */ }}
        '+': x => ['this.addTemplate(`${', x, '}`)'].join(' '),
        // {{< /* echo javascript code result, escaped */ }}
        '<': x => echoEscaped(x),
        // {{= /* echo javascript code result with possible XSS (raw as it is) */}}
        '=': x => echo(x),
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

    return compiled.join(`\n`);
  }
}
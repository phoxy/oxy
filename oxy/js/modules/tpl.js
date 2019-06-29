class template_context {
  buffer = [];

  construct(args) {
  }

  append(text) {
    this.buffer.push(text);
  }

  async html() {
    const resolved = await Promise.all(this.buffer)
    return resolved.join(`\n`);
  }

  addTemplate(address) {
    this.append(`TODO: addTemplate ${address}`);
  }
}

class template_instance {
  constructor() {
    const on = {
      render: {
        html: null,
        finished: null,
      },
      dom: {
        attached: null,
      }
    };

    const create_promise = () => {
      let run;
      let p = new Promise(r => run = r);
      return [p, run];
    }

    const recursive = (obj) => {
      let ret = {on: {}, handle: {}};

      for (let k in obj) {
        const v = obj[k];
        let on, handle;
        if (v !== null) 
          [on, handle] = recursive(v);
        else
          [on, handle] = create_promise();
        
        [ret.on[k], ret.handle[k]] = [on, handle]; 
      }

      return [ret.on, ret.handle];
    }

    [this.on, this.handle] = recursive(on);
  }
}

class template_functor {
  constructor(name, code) {
    const inject =
      [
        `return function tpl_${name}() {`,
        code,
        `}`
      ].join(`\n`);

    this.eval = new Function(inject)();
  }

  context(args) {
    const context = new template_context(args);

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

  instance() {
    return new template_instance();
  }

  run(args) {
    const context = this.context(args);
    const last_output = this.eval.call(context);

    if (last_output)
      context.append(last_output);

    const instance = this.instance();

    instance.on.render.html
      .then(html => {
        console.log('appending to dom');
      })

    context.html()
      .then(x => instance.handle.render.html(x))

    return instance;

  }
}

export class tpl {
  async render(address, args = {}) {
    const code = await oxy.loader.rest(`tpl/${address}.tpl`);
    const name = address.replace(/[^\w\d]/g, `_`);

    const compiled = await this.compile(code);
    const template = new template_functor(name, compiled);

    const html = template.run(args);

    return html;
    //return instance.render(args);
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

    chunks[0] = `=${chunks[0]}`;
    const compiled = chunks.map(x => process(x));

    console.log(compiled);

    return compiled.join(`\n`);
  }
}
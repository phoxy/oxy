export class tpl {
  async render(address, args = {}) {
    const code = await oxy.loader.rest(`tpl/${address}.tpl`);

    const template = this.compile(code);

    return "test";
  }

  async compile(code) {
    let chunks = code.split(`{{`);

    if (chunks.find(x => x.includes(`{{`)))
      throw new Error(`Unexpected '{{' found, '}}' expected.`);

    const escapeHTML = x => x; // todo

    const echo = x => x == '' ? '' : `this.append('${x}')`;

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
        echo(outsideBrackets),
      ].join('');
    }

    chunks[0] = `=${chunks[0]}`;
    const compiled = chunks.map(x => process(x));

    console.log(compiled);
  }
}

class template_instance {
  buffer = [];

  construct() {

  }

  append(text) {
    this.buffer.push(text);
  }

  async html() {
    const resolved = await Promise.all(this.buffer)
    return resolved.join(`\n`);
  }

  async addTemplate(address) {

  }
}
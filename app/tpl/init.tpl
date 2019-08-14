{{+ `frame/index` }}

<test>
Test
{{ console.log('cool') }}
<h1>test</h1>
</test>

{{< '<xss>fine</xss>' }}
{{= '<raw>fine</raw>' }}

/* this going to be loaded BEFORE first render */
{ {r https://code.jquery.com/jquery-3.4.1.slim.min.js } }

{{
oxy.app.displayState = async state => {

  const instance = await oxy.tpl.render(state.url);
  const node = await instance.render.node;

  await oxy.loader.DOMUpdateTimeslot();
  document.getElementById('oxy-default-render-place').appendChild(node);

  console.log('start loading your state here')
}

}}


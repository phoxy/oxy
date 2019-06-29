{{+ `frame/index` }}
Test
<h1>test</h1>
{{ console.log('cool') }}

{{< '<xss>fine</xss>' }}
{{= '<raw>fine</raw>' }}
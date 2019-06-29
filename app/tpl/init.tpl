{{+ `frame/index` }}

<test>
Test
{{ console.log('cool') }}
<h1>test</h1>
</test>

{{< '<xss>fine</xss>' }}
{{= '<raw>fine</raw>' }}
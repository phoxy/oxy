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



{{+ `canvas` }}

<div>

{{ for (i = 0; i < 100; i++){ }}
  {{+ `/home/index`, {i} }}
{{ } }}

</div>

{{:
console.log('just me', root);
}}

{{;
console.log('me & childs', root);
}}


{{$
console.log('me inside jquery', root);
}}


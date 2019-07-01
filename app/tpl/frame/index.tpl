<div>

{{ for (i = 0; i < 10000; i++){ }}
  {{+ `home/index`, {i} }}
{{ } }}

</div>
{{
const wait = () => new Promise(_ => setTimeout(_, 10000))

await wait();

}}
// Small concurrency primitives shared by background jobs and read-only work.
// Never use singleFlight for rewards, purchases, or other state mutations.
function createSingleFlight(){
    const pending = new Map();
    return function singleFlight(key, task){
        if(pending.has(key)) return pending.get(key);
        const promise = Promise.resolve().then(task).finally(() => {
            if(pending.get(key) === promise) pending.delete(key);
        });
        pending.set(key, promise);
        return promise;
    };
}

function nonOverlapping(task, onError = error => console.error("Background job failed:", error)){
    let running = false;
    return async function run(...args){
        if(running) return;
        running = true;
        try{ return await task(...args); }
        catch(error){ onError(error); }
        finally{ running = false; }
    };
}

function setNonOverlappingInterval(task, milliseconds){
    return setInterval(nonOverlapping(task), milliseconds);
}

module.exports = {createSingleFlight, nonOverlapping, setNonOverlappingInterval};

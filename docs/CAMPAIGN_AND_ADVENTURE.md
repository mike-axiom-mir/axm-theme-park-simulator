# Campaign and Adventure Contract

Campaigns inherit real state: geography, assets, finances, staff, audiences,
history, obligations, and unresolved tensions. Objectives and endings inspect that
state through evidence tags and contract metrics.

Several endings can be available simultaneously. The player may choose a viable
future rather than discovering one author-approved answer.

Adventure mode consumes the same snapshot. An observation stores its tick and
state hash. Walking to a queue, riding an attraction, or inspecting a broken area
can reveal evidence, but cannot silently rewrite the queue, ride, or maintenance
state.

An adventure action that should affect the world—opening a gate, requesting a
repair, changing a sign—must return through the normal domain action/event path.

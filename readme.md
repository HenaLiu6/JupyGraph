# JupyGraph
(Name may be changed later)

A New Paradigm in Integrated Development Environments
JupyGraph is a graph-based IDE designed to separate code spatially, maintaining the idea of context across a project even when you are working on multiple different things simultaneously.

Graph-based editors are not a new invention. However, many past implementations have been block-based, effectively creating "Scratch for adults." This approach often renders them unviable for serious development, where simple one-liners become sprawling chains of nodes representing basic arithmetic operators (e.g., implementing a noise function requires dozens of nodes).

JupyGraph is different. Here, nodes represent your own code blocks. Think of it as Jupyter Notebook, but where nodes can be freely moved and connected across space.

## Why JupyGraph?

The primary advantage over traditional Jupyter Notebooks is the superior representation of context.

Consider a standard linear notebook where you are working on three different models derived from the same dataset:

```
[My data]
[Model A of data]
[Model B of data]
[Model C of data]
```

In this linear format, if you are focusing on Model C, you must execute the initial nodes, then skip over all the code related to Models A and B, before finally reaching your target. This makes it difficult to track which code belongs to which piece of data or logic.

With JupyGraph, we separate these logically:

```
          ---[Model A of data]
[My data]----[Model B of data]
          ---[Model C of data]
```

Now, you can easily infer the context of the code you are working on and its relationship to other parts of the system. Furthermore, as you expand your work, the structure remains clear

```
          ---[Model A of data] - [Model A Visualization]
[My data]----[Model B of data] - [Model B Ablation study]
          ---[Model C of data] - [Model C Visualization]
```

In a linear notebook, adding these visualizations would push code further down, forcing you to scroll past irrelevant sections to find what matters. In JupyGraph, the spatial arrangement ensures that related code stays grouped, regardless of how much you expand each branch.

## Design Choices

I've been using LiteGraph for the frontend, with the idea that styles made for projects like ComfyUI could possibly also be adapted to this project. Though currently I hacked togther some other UI elements to interact with the graphs.

## Demo

Not a final demo, but I made a short video showing that the IDE allows executing graphs and shows intermediate results.

https://www.bilibili.com/video/BV1675B6LECT/ 


## How does the project work?

This architecture is still being iterated on, as my requirements for the project are not yet fully finalized. Currently, I offer two modes of execution:

* Graph-based Execution. 

When you run a node, the system iterates through its parent nodes, executing them and storing their results in a node-wise variable table (vtable). When the child node runs, it looks through the parents' vtables to resolve any unknown variables or functions.

This mode also caches the results of a node in its own vtable, meaning you can often avoid re-running code if the inputs haven't changed. Caveat: This approach models randomness poorly, as cached results will not reflect new random states.

* Persistent State.

In this mode, the engine maintains a single, global persistent vtable that is updated across all nodes as they run. This behavior is more similar to the standard execution model found in Jupyter Notebook.


# JupyGraph
(Name may be changed later)

A New Paradigm in Integrated Development Environments

![RockPaperScissorsExample](./GitAssets/JupyExample.mov)

JupyGraph is a graph-based IDE designed to help users iterate on software, by having blocks of code be isolated into nodes that are connected together to create the program flow. With code separated into blocks, it is easy to replace or move sections of code, and the spatial position can be used to imply association. For example, instead of commenting out a section of code that needs to be replaced, a new node can be written to replace the old, and if you are unsure which solution was better, you can keep the old node next to the other as a quick drop-in replacement for the future.

Graph-based editors are not a new invention. However, many past implementations have been block-based instead. These more Scratch-like editors, rather than helping with the development process, make it overall more cumbersome to write code, favoring instead being visually intuitive.

JupyGraph is different. Here, nodes represent your own code blocks. Think of it as Jupyter Notebook, but where nodes can be freely moved and connected across space.

## Why JupyGraph?

The primary advantage over traditional Jupyter Notebooks is the superior representation of context.

Consider a standard linear notebook where you are working on a machine learning task, with three different models derived from the same dataset:

```
[My data]
[Model A of data]
[Model B of data]
[Model C of data]
```

In this linear format, if you are focusing on Model C, you must execute the initial nodes, then skip over all the code related to Models A and B, before finally reaching your target. Scrolling past all the lines related to one or more models can makes it difficult to track which code belongs to which piece of data or logic.

With JupyGraph, we can separate these spatially. Now finding Model C is as easy as following the third connection from the data defining node.

```
          ---[Model A of data]
[My data]----[Model B of data]
          ---[Model C of data]
```

You can easily infer the context of the code you are working on and its relationship to other parts of the system. Furthermore, as you expand your work, the structure remains clear

```
          ---[Model A of data] - [Model A Visualization]
[My data]----[Model B of data] - [Model B Ablation study]
          ---[Model C of data] - [Model C Visualization]
```

In a linear notebook, adding these visualizations would push code further down, forcing you to scroll past irrelevant sections to find what matters. In JupyGraph, the spatial arrangement ensures that related code stays grouped, regardless of how much you expand each branch.

This is just one example of why JupyGraph is good. One of the main benefits is still the ability to replace and keep old code. But that isn't easy to visualize in this way.

## Design Choices

I've been using LiteGraph for the frontend, with the idea that styles made for projects like ComfyUI could possibly also be adapted to this project. Though currently I hacked togther some other UI elements to interact with the graphs, which makes it not rely on a resuable style.

My focus for developing this project, is getting the overall idea implemented. I using AI to help especially with the frontend, however, when the project is finished and working well, I expect to remake the frontend.

## Demo

Not a final demo, but I made a short video showing that the IDE allows executing graphs and shows intermediate results.

https://youtube.com/shorts/dKLkLIEZFGk


## How does the project work?

This architecture is still being iterated on, as my requirements for the project are not yet fully finalized. Currently, I offer two modes of execution:

* Graph-based Execution. 

When you run a node, the system iterates through its parent nodes, executing them and storing their results in a node-wise variable table (vtable). When the child node runs, it looks through the parents' vtables to resolve any unknown variables or functions.

This mode also caches the results of a node in its own vtable, meaning you can often avoid re-running code if the inputs haven't changed. Caveat: This approach models randomness poorly, as cached results will not reflect new random states.

* Persistent State.

In this mode, the engine maintains a single, global persistent vtable that is updated across all nodes as they run. This behavior is more similar to the standard execution model found in Jupyter Notebook.


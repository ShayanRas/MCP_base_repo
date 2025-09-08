## MCP Building Process:

1 - To start type "let's start building" and wait for Claude to review the MCP knowledge base and become an expert in MCP server and tool development. 
2 - Simply explain what your vision is in your own words
3 - Add "ultrathink, Let's Discuss Consciely"
4 - Hit enter (send message)
5 - Answer the Agent's clarifying questions and 
6 - go into PLAN MODE
7 - add "ultrathink" to the end of your prompt and
8 - Hit enter (send message)
9 - Review the plan and make any changes to plan as needed
10 - Accept the plan and switch to auto-edit mode.
11 - Watch your AI Agent build and integrate the MCP server and tools into the MCP hub.
12 - Launch ./START_HERE.sh (mac) or ./START_HERE.bat (windows powershell) to start the MCP hub.
13 - Select your MCP server to install and add to Claude Desktop
14 - Close and restart Claude Desktop and see your MCP working

Congradulations! You've successfully built your first MCP server and tools. You can now use them to build and integrate more MCP servers and tools into the MCP hub!











## When things get complex or you're facing a bug, add AFTER your error message to the start of the prompt:
---GO INTO PLAN MODE---
[Paste your error message]
You are an experienced and expert software engineer and full stack developer who loves to approach problems fundamentally and methodically. You think hard and step by step to uncover root cause of bugs. You have an eye for best practices, never take shortcuts and patch work, and always approach implementation with fundamental, proper design and architecture in mind. ultrathink and propose the optimal solution. 

## Condensed Version: 
---GO INTO PLAN MODE---
[Add your error message]    
Think step by step, underestand the cause, think about implmications and potential recurrance points, and fix them.  

## When you want your Agent to add a new feature to existing implementation: 
---GO INTO PLAN MODE---
[Add your feature request idea]
Your are an expert software architect and engineer who loves to approach problems fundamentally and methodically. You review and reflect on the existing patterns in the codebase, and strive to integrate in the code the new feature in a way that is consistent with the existing patterns, unless existing patterns are broke, require refactoring, or are not following best practices, in which case you must first fixt the underlying issues. think step by step, understand the request, think about implmications and potential elements touched by it, and implement it pls

## Condensed Version: 
---GO INTO PLAN MODE---
[Add your feature request idea]
Think step by step, understand the request, think about implmications and potential elements touched by it, and implement it pls

## When your code needs to be refactored or optimized: 
---GO INTO PLAN MODE---
You are an expert software architect and engineer who loves to approach problems fundamentally and methodically. You review and reflect on the existing patterns in the codebase, reflect on their correctness and look for potential issues and opportunities for improvement. You LOVE best practices and never take shortcuts and patch work, and always approach implementation with fundamental, proper design and architecture in mind. ultrathink and review the code and it's current state in [@ TAG YOUR DESIRED SCRIPT OR DIR HERE] and propose an optimized refactoring plan
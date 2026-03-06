"""Lumina-Red CLI - Adversarial AI Unit."""

import asyncio
from pathlib import Path

try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).resolve().parent.parent / ".env")
except ImportError:
    pass
import json
import sys
from pathlib import Path

import typer
from rich.console import Console
from rich.live import Live
from rich.table import Table

# Add project root to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.attack_modules import (
    PIILeakageModule,
    PromptInjectionModule,
    ToxicityBiasModule,
)
from src.providers import AnthropicProvider, OllamaProvider, OpenAIProvider
from src.streamer import LogStreamer

app = typer.Typer(
    name="lumina-red",
    help="LUMINA-RED: Adversarial AI Unit - Red Teaming CLI Engine",
)
console = Console()


def get_provider(provider_name: str):
    """Resolve provider by name."""
    providers = {
        "openai": OpenAIProvider,
        "anthropic": AnthropicProvider,
        "ollama": OllamaProvider,
    }
    cls = providers.get(provider_name.lower())
    if not cls:
        raise typer.BadParameter(f"Unknown provider: {provider_name}")
    return cls()


@app.command()
def run(
    provider: str = typer.Option("ollama", "--provider", "-p", help="API provider: openai, anthropic, ollama"),
    model: str = typer.Option("default", "--model", "-m", help="Model name (default varies by provider)"),
    modules: str = typer.Option(
        "all",
        "--modules",
        "-M",
        help="Comma-separated: prompt_injection,pii_leakage,toxicity_bias, or 'all'",
    ),
    output: Path = typer.Option(
        Path("attack_logs.json"),
        "--output",
        "-o",
        help="Output JSON log file path",
        path_type=Path,
    ),
    ws_port: int = typer.Option(8765, "--ws-port", help="WebSocket port for live dashboard"),
    no_ws: bool = typer.Option(False, "--no-ws", help="Disable WebSocket server"),
) -> None:
    """Run the red teaming engine with selected attack modules."""
    asyncio.run(
        _run_async(
            provider=provider,
            model=model,
            modules=modules,
            output=output,
            ws_port=ws_port,
            no_ws=no_ws,
        )
    )


async def _run_async(
    provider: str,
    model: str,
    modules: str,
    output: Path,
    ws_port: int,
    no_ws: bool,
) -> None:
    # Clear/create output file
    output.write_text("", encoding="utf-8")

    client = get_provider(provider)
    streamer = LogStreamer(
        output_file=output,
        ws_port=ws_port,
        enable_ws=not no_ws,
    )

    if streamer.enable_ws:
        await streamer.start_ws_server()
        console.print(f"[cyan]WebSocket server listening on ws://127.0.0.1:{ws_port}[/cyan]")

    module_list = (
        ["prompt_injection", "pii_leakage", "toxicity_bias"]
        if modules.lower() == "all"
        else [m.strip() for m in modules.split(",") if m.strip()]
    )

    attack_modules = {
        "prompt_injection": PromptInjectionModule(client),
        "pii_leakage": PIILeakageModule(client),
        "toxicity_bias": ToxicityBiasModule(client),
    }

    console.print("[bold green]LUMINA-RED: Adversarial AI Unit[/bold green]")
    console.print(f"Provider: [cyan]{provider}[/cyan] | Model: [cyan]{model}[/cyan]")
    console.print(f"Output: [cyan]{output}[/cyan]\n")

    for mod_name in module_list:
        mod = attack_modules.get(mod_name)
        if not mod:
            console.print(f"[yellow]Unknown module: {mod_name}[/yellow]")
            continue

        console.print(f"[bold]Running {mod_name}...[/bold]")
        async for log in mod.run_attack(target_model=model):
            await streamer.emit(log)
            # Stream JSON to stdout for piping
            print(json.dumps(log), flush=True)
            status_color = "red" if log["status"] == "VULNERABLE" else "green"
            console.print(
                f"  [{status_color}]{log['attack_id']}[/{status_color}] "
                f"| {log['module']} | {log['status']}"
            )

    if streamer.enable_ws:
        await streamer.stop_ws_server()

    console.print("\n[bold green]Scan complete.[/bold green]")


@app.command()
def serve_ws(
    port: int = typer.Option(8765, "--port", "-p"),
    log_file: Path = typer.Option(
        Path("attack_logs.json"),
        "--log-file",
        path_type=Path,
    ),
) -> None:
    """Serve WebSocket only, tailing an existing attack_logs.json (for demo)."""
    asyncio.run(_serve_ws_async(port, log_file))


async def _serve_ws_async(port: int, log_file: Path) -> None:
    try:
        import websockets
    except ImportError:
        console.print("[red]websockets package required. pip install websockets[/red]")
        raise typer.Exit(1)

    clients = set()

    async def handler(websocket):
        clients.add(websocket)
        # Send existing logs on connect
        if log_file.exists():
            for line in log_file.read_text(encoding="utf-8").strip().split("\n"):
                if line.strip():
                    try:
                        await websocket.send(line)
                    except Exception:
                        break
        try:
            async for _ in websocket:
                pass
        finally:
            clients.discard(websocket)

    server = await websockets.serve(
        handler, "127.0.0.1", port, ping_interval=20, ping_timeout=20
    )
    console.print(f"[green]WebSocket server on ws://127.0.0.1:{port}[/green]")
    await asyncio.Future()  # run forever


if __name__ == "__main__":
    app()

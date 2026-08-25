import { Game } from './game/Game';
import { UI } from './ui/UI';
import './styles/main.css';

const app = document.getElementById('app');
if (!app) throw new Error('Missing #app mount node');

const game = new Game();
new UI(game, app);

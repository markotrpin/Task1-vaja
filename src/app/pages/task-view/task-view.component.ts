import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Params, Router } from '@angular/router';
import { AuthService } from 'src/app/auth.service';
import { List } from 'src/app/models/list.model';
import { Task } from 'src/app/models/task.model';
import { TaskService } from 'src/app/task.service';

@Component({
  selector: 'app-task-view',
  templateUrl: './task-view.component.html',
  styleUrls: ['./task-view.component.scss']
})
export class TaskViewComponent implements OnInit {

  lists: List[];
  tasks: Task[];

  selectedListId: string;

  constructor( private authService: AuthService, private taskService: TaskService, private route: ActivatedRoute, private router: Router) { }

  ngOnInit(): void {
    this.route.params.subscribe(
      (params: Params) =>{
        if(params.listId) {
          this.selectedListId = params.listId;
          this.taskService.getTasks(params.listId).subscribe((tasks: Task[])=>{
            this.tasks = tasks;
          })
        } else {
          this.tasks = undefined;
        }

      }
    )

    this.taskService.getLists().subscribe((lists: List[])=>{
      this.lists = lists;
    })

  }

  onTaskClick(task: Task){
    //set task to completed
    this.taskService.complete(task).subscribe(()=>{
      console.log("completed cool");
      //task has been completed
      task.completed = !task.completed;
    });
  }


  onDeleteList(){
    this.taskService.deleteList(this.selectedListId).subscribe((res: any) => {
      this.router.navigate(['/lists']);
      console.log(res);
    })
  }

  onDeleteTask(id: string){
    this.taskService.deleteTask(this.selectedListId, id).subscribe((res: any) => {
      this.tasks = this.tasks.filter(val => val._id !== id);
      console.log(res);
    })
  }

  onLogout(){
    this.authService.logout();
  }

}
